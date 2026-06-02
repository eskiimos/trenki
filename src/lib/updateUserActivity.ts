import { prisma } from './prisma';

/**
 * Обновляет время последней активности пользователя.
 * Принимает User.id (внутренний cuid), а не telegramId — раньше у email-юзеров
 * (telegramId="email_..." ) активность не обновлялась никогда.
 */
export async function updateUserActivity(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActivity: new Date() }
    });
  } catch (error) {
    // Игнорируем ошибки, чтобы не ломать основной функционал
    console.error('Failed to update user activity:', error);
  }
}
