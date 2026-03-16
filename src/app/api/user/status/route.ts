import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    // Ищем пользователя с профилем
    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { profile: true }
    });

    // Определяем, заполнен ли профиль
    const hasCompleteProfile = !!(
      user?.profile && 
      user.profile.position && 
      user.profile.number
    );

    return NextResponse.json({ 
      exists: !!user,
      hasCompleteProfile,
      user: user ? {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        profile: user.profile ? {
          position: user.profile.position,
          number: user.profile.number,
          birthDate: user.profile.birthDate,
          age: user.profile.birthDate ? (() => {
            const today = new Date();
            const birthDate = new Date(user.profile.birthDate);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            return age;
          })() : null,
          ageGroup: user.profile.ageGroup,
          height: user.profile.height,
          weight: user.profile.weight,
          strength: user.profile.strength,
          endurance: user.profile.endurance,
          speed: user.profile.speed,
          technique: user.profile.technique,
          skating: user.profile.skating,
          shooting: user.profile.shooting,
          passing: user.profile.passing,
          checking: user.profile.checking,
          overall: user.profile.overall,
          avatarUrl: user.profile.avatarUrl,
          clubLogoUrl: user.profile.clubLogoUrl
        } : null
      } : null
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}