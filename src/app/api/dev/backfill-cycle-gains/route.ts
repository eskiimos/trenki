import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  type CharacteristicType,
} from '@/lib/characteristics';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // полный прогон по всем профилям может быть долгим

// POST /api/dev/backfill-cycle-gains  { apply?: boolean, userId?: string }
//
// Восстанавливает прирост за ЗАВЕРШЁННЫЕ тренировки, у которых НЕТ ни одной
// записи CharacteristicHistory (их прирост не начислился из-за бага: update
// ставил сессию COMPLETED раньше, чем /complete успевал начислить → complete
// делал no-op). Только админ. По умолчанию dry-run (ничего не пишет).
//
// Стратегия — ИНКРЕМЕНТАЛЬНАЯ и безопасная:
//  • берём COMPLETED-сессии без истории (= никогда не начислялись), в
//    хронологическом порядке (по completedAt);
//  • начисляем прирост ПОВЕРХ текущего профиля (running стартует с текущих
//    рейтингов), множитель убывающей отдачи берётся от running — так несколько
//    пропущенных сессий накапливаются корректно относительно друг друга;
//  • на apply: обновляем профиль и пишем по строке CharacteristicHistory на
//    каждую такую сессию (eventType WORKOUT, createdAt = completedAt) — это
//    делает прогон ИДЕМПОТЕНТНЫМ (повторный запуск увидит историю и пропустит)
//    и показывает прирост на экранах результата/недавних приростов.
//
// Сессии, у которых уже ЕСТЬ любая история (включая помодульную), считаем
// начисленными и не трогаем — двойного начисления нет. Начисление поверх
// текущего состояния немного консервативнее идеального (рейтинг сейчас выше,
// чем на момент тренировки → прирост чуть меньше), зато никогда не перебор.
//
// NB: идемпотентность — на уровне приложения (чтение истории → запись вне той
// же транзакции). Узкое TOCTOU-окно: если параллельно идёт complete-module по
// той же сессии, теоретически возможна вторая строка. Сессии тут «протухшие»,
// окно мизерное — но для apply лучше запускать в тихое время.

type Ratings = Record<CharacteristicType, number>;
const CHARS: CharacteristicType[] = [
  'ratingPower', 'ratingSpeed', 'ratingEndurance', 'ratingTechnique', 'ratingFlexibility',
];
const round1 = (n: number) => parseFloat(n.toFixed(1));

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if ('response' in auth) return auth.response;
  if (!auth.user.isAdmin) {
    return NextResponse.json({ error: 'Только для администратора' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const apply = body?.apply === true;
  const onlyUserId: string | undefined = body?.userId || undefined;

  const profiles = await prisma.profile.findMany({
    where: onlyUserId ? { userId: onlyUserId } : {},
    select: {
      id: true, userId: true,
      ratingPower: true, ratingSpeed: true, ratingEndurance: true,
      ratingTechnique: true, ratingFlexibility: true, potential: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  const results: Array<{
    userId: string; name: string; missingSessions: number;
    currentPotential: number; correctedPotential: number; deltaPotential: number;
  }> = [];
  let usersChanged = 0;
  let sessionsBackfilled = 0;

  for (const p of profiles) {
    // Все завершённые сессии юзера + их видео (для типов нагрузки).
    const sessions = await prisma.workoutSession.findMany({
      where: {
        userId: p.userId,
        status: 'COMPLETED',
        // Только реально пройденные тренировки: есть видео и ВСЕ просмотрены.
        // Это отсекает дни, закрытые подстановкой (close-day): там статус
        // COMPLETED проставлен БЕЗ просмотра видео, а прирост уже дала подменная
        // быстрая тренировка — иначе был бы double-credit.
        videos: { some: {}, every: { completed: true } },
      },
      orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, completedAt: true,
        videos: { select: { video: { select: { loadType: true, moduleType: true, videoTags: { select: { tag: { select: { tagType: true, loadType: true } } } } } } } },
      },
    });
    if (sessions.length === 0) continue;

    // sessionId, по которым уже есть ЛЮБАЯ история (= начислялись) — пропускаем.
    const credited = await prisma.characteristicHistory.findMany({
      where: { userId: p.userId, sessionId: { in: sessions.map((s) => s.id) } },
      select: { sessionId: true },
    });
    const creditedIds = new Set(credited.map((c) => c.sessionId).filter((x): x is string => !!x));
    const missing = sessions.filter((s) => !creditedIds.has(s.id));
    if (missing.length === 0) continue;

    const running: Ratings = {
      ratingPower: p.ratingPower, ratingSpeed: p.ratingSpeed, ratingEndurance: p.ratingEndurance,
      ratingTechnique: p.ratingTechnique, ratingFlexibility: p.ratingFlexibility,
    };

    type Row = { sessionId: string; completedAt: Date | null; gains: Ratings; snapshot: Ratings };
    const rows: Row[] = [];

    for (const s of missing) {
      const moduleTags = s.videos.map((v) => videoLoadTypes(v.video));
      const warm = s.videos.map((v) => v.video.moduleType === 'WARMUP' || v.video.moduleType === 'COOLDOWN');
      const gains = calculateWorkoutGains(moduleTags, running, warm);
      // применяем с cap 100, рейтинги храним с точностью .1
      for (const c of CHARS) running[c] = round1(Math.min(100, running[c] + gains[c]));
      rows.push({ sessionId: s.id, completedAt: s.completedAt, gains, snapshot: { ...running } });
    }

    const correctedPotential = calculatePotential(running);
    const deltaPotential = round1(correctedPotential - p.potential);

    const changed = Math.abs(deltaPotential) >= 0.01
      || CHARS.some((c) => Math.abs(running[c] - (p as unknown as Ratings)[c]) >= 0.01);
    if (changed) usersChanged += 1;
    sessionsBackfilled += rows.length;

    results.push({
      userId: p.userId,
      name: `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim() || p.userId.slice(0, 6),
      missingSessions: rows.length,
      currentPotential: p.potential,
      correctedPotential,
      deltaPotential,
    });

    if (apply) {
      await prisma.$transaction(async (tx) => {
        // Профиль обновляем только если реально что-то изменилось.
        if (changed) {
          await tx.profile.update({
            where: { id: p.id },
            data: {
              ratingPower: running.ratingPower, ratingSpeed: running.ratingSpeed,
              ratingEndurance: running.ratingEndurance, ratingTechnique: running.ratingTechnique,
              ratingFlexibility: running.ratingFlexibility, potential: correctedPotential,
            },
          });
        }
        // Строку истории пишем ВСЕГДА на каждую сессию (даже при нулевом
        // приросте) — это маркер «начислено», который делает повторный прогон
        // идемпотентным (в следующий раз сессия уже не «missing»). createdAt НЕ
        // переопределяем (остаётся now()): иначе backfill-строка с исторической
        // датой встала бы в начало истории и сломала реконструкцию базы в старом
        // /api/dev/backfill-gains (инфляция профиля при последовательном запуске).
        for (const r of rows) {
          await tx.characteristicHistory.create({
            data: {
              userId: p.userId,
              sessionId: r.sessionId,
              ratingPower: r.snapshot.ratingPower, ratingSpeed: r.snapshot.ratingSpeed,
              ratingEndurance: r.snapshot.ratingEndurance, ratingTechnique: r.snapshot.ratingTechnique,
              ratingFlexibility: r.snapshot.ratingFlexibility,
              potential: calculatePotential(r.snapshot),
              gainPower: r.gains.ratingPower, gainSpeed: r.gains.ratingSpeed,
              gainEndurance: r.gains.ratingEndurance, gainTechnique: r.gains.ratingTechnique,
              gainFlexibility: r.gains.ratingFlexibility,
              eventType: 'WORKOUT',
            },
          });
        }
      }, { timeout: 60_000 });
    }
  }

  results.sort((a, b) => b.deltaPotential - a.deltaPotential);

  return NextResponse.json({
    dryRun: !apply,
    profilesScanned: profiles.length,
    usersChanged,
    sessionsBackfilled,
    totalPotentialDelta: round1(results.reduce((s, r) => s + r.deltaPotential, 0)),
    sample: results.slice(0, 15),
  });
}
