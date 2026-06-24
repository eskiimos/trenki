import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthUser } from '@/lib/coach/guards';
import {
  calculateWorkoutGains,
  calculatePotential,
  videoLoadTypes,
  type CharacteristicType,
} from '@/lib/characteristics';

// POST /api/dev/backfill-gains  { apply?: boolean, userId?: string }
// Пересчёт прироста за УЖЕ завершённые тренировки (после фикса начисления по
// video.loadType). Только для админа. По умолчанию dry-run (ничего не пишет) —
// возвращает дельты. apply:true применяет к профилям.
//
// Идемпотентно: для каждого юзера восстанавливаем стартовую базу из ПЕРВОЙ
// записи истории (rating − применённый gain), затем переигрываем все завершения
// с ПРАВИЛЬНЫМ приростом (videoLoadTypes) по фактическим видео сессии. База
// берётся из неизменной истории, поэтому повторный запуск даёт тот же результат.

type Ratings = Record<CharacteristicType, number>;
const CHARS: CharacteristicType[] = [
  'ratingPower', 'ratingSpeed', 'ratingEndurance', 'ratingTechnique', 'ratingFlexibility',
];

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
      userId: true,
      ratingPower: true, ratingSpeed: true, ratingEndurance: true,
      ratingTechnique: true, ratingFlexibility: true, potential: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  const results: any[] = [];
  let changedCount = 0;

  for (const p of profiles) {
    const rows = await prisma.characteristicHistory.findMany({
      where: { userId: p.userId },
      orderBy: { createdAt: 'asc' },
      select: {
        sessionId: true,
        ratingPower: true, ratingSpeed: true, ratingEndurance: true,
        ratingTechnique: true, ratingFlexibility: true,
        gainPower: true, gainSpeed: true, gainEndurance: true,
        gainTechnique: true, gainFlexibility: true,
      },
    });
    if (rows.length === 0) continue;

    // База = состояние ДО первого завершения.
    const first = rows[0];
    const running: Ratings = {
      ratingPower: first.ratingPower - first.gainPower,
      ratingSpeed: first.ratingSpeed - first.gainSpeed,
      ratingEndurance: first.ratingEndurance - first.gainEndurance,
      ratingTechnique: first.ratingTechnique - first.gainTechnique,
      ratingFlexibility: first.ratingFlexibility - first.gainFlexibility,
    };

    // Подтягиваем видео всех сессий из истории одним запросом.
    const sessionIds = rows.map((r) => r.sessionId).filter((x): x is string => !!x);
    const sessions = await prisma.workoutSession.findMany({
      where: { id: { in: sessionIds } },
      include: { videos: { include: { video: { include: { videoTags: { include: { tag: true } } } } } } },
    });
    const sMap = new Map(sessions.map((s) => [s.id, s]));

    // Дедуп по сессии: одна тренировка начисляется один раз, даже если в
    // истории несколько записей по ней (напр. построчно по модулям).
    const seenSessions = new Set<string>();
    for (const r of rows) {
      let gain: Ratings;
      if (r.sessionId) {
        if (seenSessions.has(r.sessionId)) continue;
        seenSessions.add(r.sessionId);
        const s = sMap.get(r.sessionId);
        if (s) {
          const moduleTags = s.videos.map((v) => videoLoadTypes(v.video));
          const warm = s.videos.map((v) => v.video.moduleType === 'WARMUP' || v.video.moduleType === 'COOLDOWN');
          gain = calculateWorkoutGains(moduleTags, running, warm);
        } else {
          // сессия удалена — оставляем как было записано
          gain = {
            ratingPower: r.gainPower, ratingSpeed: r.gainSpeed, ratingEndurance: r.gainEndurance,
            ratingTechnique: r.gainTechnique, ratingFlexibility: r.gainFlexibility,
          };
        }
      } else {
        // запись без сессии — берём записанный прирост как есть
        gain = {
          ratingPower: r.gainPower, ratingSpeed: r.gainSpeed, ratingEndurance: r.gainEndurance,
          ratingTechnique: r.gainTechnique, ratingFlexibility: r.gainFlexibility,
        };
      }
      for (const c of CHARS) running[c] = parseFloat((running[c] + gain[c]).toFixed(4));
    }

    const correctedPotential = calculatePotential(running);
    const deltaPotential = parseFloat((correctedPotential - p.potential).toFixed(2));

    if (Math.abs(deltaPotential) >= 0.01 ||
        CHARS.some((c) => Math.abs(running[c] - (p as any)[c]) >= 0.01)) {
      changedCount += 1;
    }

    results.push({
      userId: p.userId,
      name: `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim() || p.userId.slice(0, 6),
      completions: rows.length,
      currentPotential: p.potential,
      correctedPotential,
      deltaPotential,
    });

    if (apply) {
      await prisma.profile.update({
        where: { userId: p.userId },
        data: {
          ratingPower: running.ratingPower,
          ratingSpeed: running.ratingSpeed,
          ratingEndurance: running.ratingEndurance,
          ratingTechnique: running.ratingTechnique,
          ratingFlexibility: running.ratingFlexibility,
          potential: correctedPotential,
        },
      });
    }
  }

  // Сортируем по величине дельты — самые «недоначисленные» сверху.
  results.sort((a, b) => b.deltaPotential - a.deltaPotential);

  return NextResponse.json({
    dryRun: !apply,
    profilesScanned: profiles.length,
    usersWithHistory: results.length,
    usersChanged: changedCount,
    totalPotentialDelta: parseFloat(results.reduce((s, r) => s + r.deltaPotential, 0).toFixed(2)),
    sample: results.slice(0, 12),
  });
}
