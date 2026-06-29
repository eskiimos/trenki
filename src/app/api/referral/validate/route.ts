import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/coach/rate-limit';

// GET /api/referral/validate?code=igls26 — публичная проверка реф-кода (до входа).
// Возвращает { valid, code, label }. Матч без учёта регистра. Rate-limit по IP
// (как остальные публичные роуты) — защита от перебора кодов и нагрузки на БД.
export const dynamic = 'force-dynamic';

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  if (!rateLimit(`ref-validate:${getClientIp(request)}`, 30, 10 * 60 * 1000).ok) {
    return NextResponse.json({ valid: false }, { status: 429 });
  }
  const raw = (new URL(request.url).searchParams.get('code') || '').trim();
  if (!raw) return NextResponse.json({ valid: false });

  // Матч по основному коду (без регистра) ИЛИ по алиасу (хранится в нижнем
  // регистре; кириллица тоже корректно лоуэркейсится). Возвращаем канонический
  // rc.code — его и привяжем при регистрации.
  const rc = await prisma.referralCode.findFirst({
    where: {
      isActive: true,
      OR: [
        { code: { equals: raw, mode: 'insensitive' } },
        { aliases: { has: raw.toLowerCase() } },
      ],
    },
    select: { code: true, label: true },
  });
  if (!rc) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, code: rc.code, label: rc.label });
}
