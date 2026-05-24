import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/users/set-role
 * Body: { role: 'ATHLETE' | 'COACH' }
 */
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const role = body?.role;

  if (role !== 'ATHLETE' && role !== 'COACH') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role === role) {
    return NextResponse.json({ success: true, role });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role },
  });

  return NextResponse.json({ success: true, role });
}
