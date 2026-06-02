import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRequiredEnv } from '@/lib/validate-env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — публичный healthcheck для docker compose / nginx / мониторинга.
 *
 * 200 ok       — все обязательные env заданы И SELECT 1 к Postgres прошёл
 * 503 unhealthy — есть проблема (детали в errors[])
 *
 * Раньше healthcheck тыкал /login (всегда 200) — упавшая БД или пропавший
 * SESSION_SECRET не палились и контейнер показывался «healthy».
 */
export async function GET() {
  const errors: string[] = [];

  const envCheck = checkRequiredEnv();
  if (!envCheck.ok) {
    errors.push(
      `Missing env: ${envCheck.missing.map((m) => m.name).join(', ')}`,
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`DB unreachable: ${msg.slice(0, 200)}`);
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { status: 'unhealthy', errors },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: 'ok' });
}
