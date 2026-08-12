import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ isAdmin: false, isTester: false });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, isTester: true },
    });

    return NextResponse.json({
      isAdmin: user?.isAdmin ?? false,
      isTester: user?.isTester ?? false,
    });
  } catch {
    return NextResponse.json({ isAdmin: false, isTester: false });
  }
}
