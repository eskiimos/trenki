import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const usersCount = await prisma.user.count();
    return NextResponse.json({ 
      success: true, 
      message: 'Соединение с базой данных успешно', 
      usersCount 
    });
  } catch (error) {
    console.error('Ошибка соединения с базой данных:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Ошибка соединения с базой данных', 
      error: String(error) 
    }, { status: 500 });
  }
}