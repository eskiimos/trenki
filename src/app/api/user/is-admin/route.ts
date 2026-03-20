import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.nextUrl.searchParams.get('telegramId');
    if (!telegramId) {
      return NextResponse.json({ isAdmin: false });
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { isAdmin: true },
    });

    return NextResponse.json({ isAdmin: user?.isAdmin ?? false });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
