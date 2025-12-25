import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Код не указан' },
        { status: 400 }
      );
    }

    // Проверяем формат кода (XXX-XXX)
    const codePattern = /^[A-Z0-9]{3}-[A-Z0-9]{3}$/;
    if (!codePattern.test(code.toUpperCase())) {
      return NextResponse.json(
        { valid: false, error: 'Неверный формат кода' },
        { status: 400 }
      );
    }

    // Ищем код в базе данных
    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!inviteCode) {
      return NextResponse.json(
        { valid: false, error: 'Код не найден' },
        { status: 404 }
      );
    }

    // Проверяем, активен ли код
    if (!inviteCode.isActive) {
      return NextResponse.json(
        { valid: false, error: 'Код деактивирован' },
        { status: 403 }
      );
    }

    // Проверяем срок действия
    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      return NextResponse.json(
        { valid: false, error: 'Срок действия кода истёк' },
        { status: 403 }
      );
    }

    // Проверяем, не превышен ли лимит использований
    if (inviteCode.usedCount >= inviteCode.maxUses) {
      return NextResponse.json(
        { valid: false, error: 'Код уже использован максимальное количество раз' },
        { status: 403 }
      );
    }

    // Код валиден
    return NextResponse.json({
      valid: true,
      code: inviteCode.code,
      description: inviteCode.description,
    });

  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json(
      { valid: false, error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

// GET метод для проверки кода без увеличения счётчика использований
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { valid: false, error: 'Код не указан' },
        { status: 400 }
      );
    }

    const inviteCode = await prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!inviteCode || !inviteCode.isActive) {
      return NextResponse.json({ valid: false });
    }

    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      return NextResponse.json({ valid: false });
    }

    if (inviteCode.usedCount >= inviteCode.maxUses) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({ valid: true });

  } catch (error) {
    console.error('Error checking invite code:', error);
    return NextResponse.json(
      { valid: false, error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
