import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { User } from '../../generated/prisma';

/**
 * Достаёт текущего пользователя по cookie telegramId.
 * Возвращает либо пользователя, либо NextResponse с 401.
 */
export async function requireAuthUser(
  request: NextRequest,
): Promise<{ user: User } | { response: NextResponse }> {
  const telegramId = request.cookies.get('telegramId')?.value;
  if (!telegramId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    return { response: NextResponse.json({ error: 'User not found' }, { status: 401 }) };
  }
  return { user };
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
