import { prisma } from './prisma';

/**
 * Обновляет время последней активности пользователя
 * Вызывать при любом действии пользователя в приложении
 */
export async function updateUserActivity(telegramId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { telegramId },
      data: { lastActivity: new Date() }
    });
  } catch (error) {
    // Игнорируем ошибки, чтобы не ломать основной функционал
    console.error('Failed to update user activity:', error);
  }
}
