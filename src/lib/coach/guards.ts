import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { User } from '../../generated/prisma';
import { getSessionFromRequest } from '@/lib/session';
import { getPaywallMode } from '@/lib/settings';
import { isPaywalled } from '@/lib/paywall';

/**
 * Достаёт текущего пользователя по подписанной сессии (httpOnly cookie).
 * Возвращает либо пользователя, либо NextResponse с 401.
 */
export async function requireAuthUser(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user) {
    return { response: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
  }
  return { user };
}

/**
 * Требует авторизованного пользователя С активной подпиской — с учётом режима
 * paywall (AppSetting paywall.mode, см. '@/lib/paywall').
 * - режим 'off'    → не блокирует НИКОГДА (paywall выключен, безопасно для деплоя);
 * - режим 'admins' → блокирует только админов приложения (обкатка), живых юзеров пропускает;
 * - режим 'on'     → блокирует всех без активного премиума.
 * При блокировке отдаёт 402 с кодом SUBSCRIPTION_REQUIRED (клиент показывает paywall).
 * Навешивать на роуты, отдающие платный ресурс (видео-URL, ИИ-план, микроцикл).
 */
export async function requireActiveSubscription(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const result = await requireAuthUser(request);
  if ('response' in result) return result;
  const mode = await getPaywallMode();
  if (isPaywalled(result.user, mode)) {
    return {
      response: NextResponse.json(
        { error: 'Subscription required', code: 'SUBSCRIPTION_REQUIRED' },
        { status: 402 },
      ),
    };
  }
  return { user: result.user };
}

/**
 * Гейт для роутов, отдающих платный КОНТЕНТ, которые исторически были ПУБЛИЧНЫМИ
 * (видео-URL, kinescope-метаданные). В режиме 'off' — НЕ трогаем (остаётся как было,
 * без обязательной авторизации), чтобы не поломать текущее поведение при выключенном
 * paywall. Как только paywall включён (admins/on) — требуем активную подписку.
 * Возвращает null, если запрос можно пропустить, или NextResponse, если блокируем.
 */
export async function gatePaidContent(request: NextRequest): Promise<NextResponse | null> {
  const mode = await getPaywallMode();
  if (mode === 'off') return null;
  const gate = await requireActiveSubscription(request);
  return 'response' in gate ? gate.response : null;
}

/**
 * Требует пользователя с ролью COACH.
 */
export async function requireCoach(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const result = await requireAuthUser(request);
  if ('response' in result) return result;
  if (result.user.role !== 'COACH') {
    return { response: NextResponse.json({ error: 'Forbidden: coach role required' }, { status: 403 }) };
  }
  return { user: result.user };
}

/**
 * Требует пользователя с ролью ATHLETE.
 */
export async function requireAthlete(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const result = await requireAuthUser(request);
  if ('response' in result) return result;
  if (result.user.role !== 'ATHLETE') {
    return { response: NextResponse.json({ error: 'Forbidden: athlete role required' }, { status: 403 }) };
  }
  return { user: result.user };
}

/**
 * Проверяет, что команда принадлежит тренеру.
 */
export async function requireTeamOwnership(
  coachId: string,
  teamId: string,
): Promise<boolean> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  return Boolean(team && team.createdBy === coachId);
}
