import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminAsync } from '@/lib/admin-session';
import { hasPremium } from '@/lib/access';

// Админ-API реферальных каналов. Только isAdmin (requireAdminAsync).
//  GET    — список кодов + статистика (регистрации / прошли онбординг / активны
//           за 7д) + сами пользователи (для дрилл-дауна и CSV на клиенте).
//  POST   — создать код { code (латиница), label, note?, aliases?, trialDays? }.
//  PATCH  — { id, isActive?, label?, note?, aliases?, trialDays? } — вкл/выкл и редактирование.
//  DELETE — ?id=... удалить код (привязки User.referralCode остаются как есть).

export const dynamic = 'force-dynamic';

const CODE_RE = /^[a-z0-9_-]{2,40}$/;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// Алиасы для ручного ввода (в т.ч. кириллица): принимаем массив или строку через
// запятую, храним в нижнем регистре, без дублей и без пустых.
function parseAliases(input: unknown): string[] {
  const arr = Array.isArray(input)
    ? input.map((s) => String(s))
    : typeof input === 'string'
      ? input.split(',')
      : [];
  return Array.from(new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean)));
}

// Пробный период по коду: целое 0..365 дней. Возвращает null, если значение
// задано, но некорректно (чтобы вернуть 400, а не молча обнулить).
const MAX_TRIAL_DAYS = 365;
function parseTrialDays(input: unknown): number | null {
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0 || n > MAX_TRIAL_DAYS) return null;
  return n;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const codes = await prisma.referralCode.findMany({ orderBy: { createdAt: 'desc' } });
    const now = Date.now();

    // Один запрос на всех (без N+1): тянем юзеров по всем кодам и группируем.
    const allUsers = await prisma.user.findMany({
      where: { referralCode: { in: codes.map((c) => c.code) } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, firstName: true, lastName: true, email: true, role: true,
        createdAt: true, lastActivity: true, referralCode: true,
        accessTier: true, premiumUntil: true,
        profile: { select: { id: true } },
        coachProfile: { select: { userId: true } },
      },
    });
    const byCode = new Map<string, typeof allUsers>();
    for (const u of allUsers) {
      if (!u.referralCode) continue;
      const arr = byCode.get(u.referralCode);
      if (arr) arr.push(u); else byCode.set(u.referralCode, [u]);
    }

    // active7d: вернулся хотя бы спустя минуту после регистрации (иначе свежая
    // регистрация с lastActivity==createdAt ложно считалась бы «активной») и в
    // пределах 7 дней.
    const ACTIVE_MIN_GAP = 60_000;
    const withUsers = codes.map((c) => {
      const users = byCode.get(c.code) ?? [];
      const onboarded = users.filter((u) => u.profile || u.coachProfile).length;
      // Премиум «на сейчас» — единая проверка hasPremium (PREMIUM + срок не истёк).
      const premium = users.filter((u) => hasPremium(u)).length;
      const active7d = users.filter((u) => {
        const la = new Date(u.lastActivity).getTime();
        const ca = new Date(u.createdAt).getTime();
        return la - ca > ACTIVE_MIN_GAP && now - la <= SEVEN_DAYS;
      }).length;
      return {
        id: c.id, code: c.code, label: c.label, aliases: c.aliases, isActive: c.isActive, note: c.note, trialDays: c.trialDays, createdAt: c.createdAt,
        stats: { registrations: users.length, onboarded, active7d, premium },
        users: users.map((u) => ({
          id: u.id,
          name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || '—',
          email: u.email,
          role: u.role,
          onboarded: !!(u.profile || u.coachProfile),
          premium: hasPremium(u),
          createdAt: u.createdAt,
          lastActivity: u.lastActivity,
        })),
      };
    });

    const totalRegs = withUsers.reduce((s, c) => s + c.stats.registrations, 0);
    return NextResponse.json({
      codes: withUsers,
      stats: {
        total: codes.length,
        active: codes.filter((c) => c.isActive).length,
        totalRegistrations: totalRegs,
      },
    });
  } catch (error) {
    console.error('referrals GET failed', error);
    return NextResponse.json({ error: 'Ошибка загрузки реф-кодов' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body?.code || '').trim().toLowerCase();
    const label = String(body?.label || '').trim();
    const note = body?.note ? String(body.note).trim() : null;

    if (!CODE_RE.test(code)) {
      return NextResponse.json(
        { error: 'Код: 2–40 символов, латиница/цифры/_/- (без кириллицы и пробелов)' },
        { status: 400 },
      );
    }
    if (!label) {
      return NextResponse.json({ error: 'Укажите название (label)' }, { status: 400 });
    }
    // trialDays необязателен при создании; по умолчанию 0 (без триала).
    const trialDays = body?.trialDays === undefined ? 0 : parseTrialDays(body.trialDays);
    if (trialDays === null) {
      return NextResponse.json({ error: `Пробный период — целое от 0 до ${MAX_TRIAL_DAYS} дней` }, { status: 400 });
    }

    const exists = await prisma.referralCode.findUnique({ where: { code } });
    if (exists) {
      return NextResponse.json({ error: 'Такой код уже есть' }, { status: 409 });
    }

    const created = await prisma.referralCode.create({
      data: { code, label, note, aliases: parseAliases(body?.aliases), trialDays },
    });
    return NextResponse.json({ success: true, code: created }, { status: 201 });
  } catch (error) {
    console.error('referrals POST failed', error);
    return NextResponse.json({ error: 'Ошибка создания кода' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '');
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 });

    const data: { isActive?: boolean; label?: string; note?: string | null; aliases?: string[]; trialDays?: number } = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (typeof body.label === 'string' && body.label.trim()) data.label = body.label.trim();
    if (typeof body.note === 'string') data.note = body.note.trim() || null;
    if (body.aliases !== undefined) data.aliases = parseAliases(body.aliases);
    if (body.trialDays !== undefined) {
      const td = parseTrialDays(body.trialDays);
      if (td === null) {
        return NextResponse.json({ error: `Пробный период — целое от 0 до ${MAX_TRIAL_DAYS} дней` }, { status: 400 });
      }
      data.trialDays = td;
    }

    const updated = await prisma.referralCode.update({ where: { id }, data });
    return NextResponse.json({ success: true, code: updated });
  } catch (error) {
    console.error('referrals PATCH failed', error);
    return NextResponse.json({ error: 'Ошибка обновления кода' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdminAsync(request);
  if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id не указан' }, { status: 400 });
    await prisma.referralCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('referrals DELETE failed', error);
    return NextResponse.json({ error: 'Ошибка удаления кода' }, { status: 500 });
  }
}
