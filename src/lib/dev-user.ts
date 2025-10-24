/**
 * Dev Mode утилиты для автоматического создания тестовых пользователей
 * Используется только в development режиме
 */

import prisma from '@/lib/prisma';
import { Gender, HockeyPosition } from '@/generated/prisma';

/**
 * Проверяет и создаёт dev пользователя в БД, если его нет
 * @param userId - ID пользователя (обычно dev_TIMESTAMP)
 * @returns User объект из БД
 */
export async function ensureDevUser(userId: string) {
  // Работает только в development и только для dev_ пользователей
  if (process.env.NODE_ENV !== 'development' || !userId.startsWith('dev_')) {
    return null;
  }

  console.log('🔧 DEV MODE: Checking user in DB:', userId);

  // Проверяем, есть ли пользователь в БД
  let user = await prisma.user.findUnique({
    where: { telegramId: userId },
    include: { profile: true },
  });

  if (!user) {
    console.log('🔧 DEV MODE: Creating new dev user in DB');
    
    // Создаём тестового пользователя с профилем
    user = await prisma.user.create({
      data: {
        telegramId: userId,
        firstName: 'Dev',
        lastName: 'User',
        username: 'dev_user',
        profile: {
          create: {
            age: 25,
            gender: Gender.MALE,
            position: HockeyPosition.CENTER,
            height: 180,
            weight: 75,
            strength: 5,
            endurance: 5,
            speed: 5,
            technique: 5,
            skating: 5,
            shooting: 5,
            passing: 5,
            checking: 5,
            overall: 5,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    console.log('✅ DEV MODE: Created user:', user);
  } else {
    console.log('✅ DEV MODE: User exists in DB');
  }

  return user;
}
