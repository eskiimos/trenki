import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Получаем все инвайт-коды с информацией о пользователях
    const inviteCodes = await prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Для каждого кода находим пользователей, которые его использовали
    const codesWithUsers = await Promise.all(
      inviteCodes.map(async (code) => {
        const users = await prisma.user.findMany({
          where: { inviteCode: code.code },
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
            createdAt: true,
          },
        });

        return {
          ...code,
          users,
        };
      })
    );

    // Статистика
    const totalCodes = inviteCodes.length;
    const activeCodes = inviteCodes.filter(c => c.isActive).length;
    const usedCodes = inviteCodes.filter(c => c.usedCount > 0).length;
    const fullyUsedCodes = inviteCodes.filter(c => c.usedCount >= c.maxUses).length;

    return NextResponse.json({
      codes: codesWithUsers,
      stats: {
        total: totalCodes,
        active: activeCodes,
        used: usedCodes,
        fullyUsed: fullyUsedCodes,
      },
    });
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    return NextResponse.json(
      { error: 'Ошибка загрузки инвайт-кодов' },
      { status: 500 }
    );
  }
}

// Деактивация кода
export async function PATCH(request: NextRequest) {
  try {
    const { codeId, isActive } = await request.json();

    const updatedCode = await prisma.inviteCode.update({
      where: { id: codeId },
      data: { isActive },
    });

    return NextResponse.json({ success: true, code: updatedCode });
  } catch (error) {
    console.error('Error updating invite code:', error);
    return NextResponse.json(
      { error: 'Ошибка обновления кода' },
      { status: 500 }
    );
  }
}

// Удаление кода
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json(
        { error: 'ID кода не указан' },
        { status: 400 }
      );
    }

    await prisma.inviteCode.delete({
      where: { id: codeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invite code:', error);
    return NextResponse.json(
      { error: 'Ошибка удаления кода' },
      { status: 500 }
    );
  }
}
