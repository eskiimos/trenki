import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatWorkoutTime } from '@/lib/telegram';
import { notifyUser } from '@/lib/notify';

/**
 * Cron: проверка ScheduledWorkout и отправка напоминаний.
 *
 * Вызывается каждую минуту через host-cron (на reg.ru — crontab):
 *   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/check-workouts
 *
 * Уведомление уходит в Telegram, если у юзера валидный telegram chat_id,
 * иначе — в web-push (для email-юзеров с синтетическим telegramId).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET не задан в env');
      return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.WEB_APP_URL?.trim() ||
      'https://trenki.app';

    const now = new Date();
    console.log(`🕐 Checking scheduled workouts at ${now.toISOString()}`);

    const in35Minutes = new Date(now.getTime() + 35 * 60 * 1000);
    const in25Minutes = new Date(now.getTime() + 25 * 60 * 1000);
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    const in5Minutes = new Date(now.getTime() + 5 * 60 * 1000);

    const select = {
      id: true,
      userId: true,
      date: true,
      user: { select: { id: true, telegramId: true, firstName: true } },
      video: {
        select: {
          id: true,
          title: true,
          duration: true,
          trainer: { select: { name: true, lastName: true } },
        },
      },
    } as const;

    // ========== Уведомления за 30 минут ==========
    const workoutsIn30Min = await prisma.scheduledWorkout.findMany({
      where: {
        date: { gte: in25Minutes, lte: in35Minutes },
        notification30MinSent: false,
        completed: false,
      },
      select,
    });

    console.log(`📢 Found ${workoutsIn30Min.length} workouts starting in ~30 minutes`);

    let sent30 = 0;
    for (const workout of workoutsIn30Min) {
      const trainerName = `${workout.video.trainer.name} ${workout.video.trainer.lastName}`;
      const workoutTime = formatWorkoutTime(workout.date);

      const telegramMessage = `⏰ Через 30 минут начнется тренировка!\n\n🎬 ${workout.video.title}\n👤 Тренер: ${trainerName}\n⏱ Длительность: ${Math.round(workout.video.duration / 60)} мин\n📅 ${workoutTime}\n\nНачни готовиться! 💪`;

      const channel = await notifyUser(workout.user, {
        title: '⏰ Через 30 минут тренировка',
        body: workout.video.title,
        url: `/video/${workout.video.id}`,
        telegramMessage,
        telegramOptions: {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🚀 Начать тренировку', web_app: { url: `${appUrl}/video/${workout.video.id}` } }],
              [{ text: '📅 Мои тренировки', web_app: { url: `${appUrl}/calendar` } }],
            ],
          },
        },
      });

      if (channel !== 'none') {
        await prisma.scheduledWorkout.update({
          where: { id: workout.id },
          data: { notification30MinSent: true },
        });
        sent30 += 1;
        console.log(`✅ 30-min notification (${channel}) sent to ${workout.user.firstName}`);
      } else {
        console.error(`❌ 30-min notification failed for user ${workout.userId}`);
      }
    }

    // ========== Уведомления за 10 минут ==========
    const workoutsIn10Min = await prisma.scheduledWorkout.findMany({
      where: {
        date: { gte: in5Minutes, lte: in15Minutes },
        notification10MinSent: false,
        completed: false,
      },
      select,
    });

    console.log(`📢 Found ${workoutsIn10Min.length} workouts starting in ~10 minutes`);

    let sent10 = 0;
    for (const workout of workoutsIn10Min) {
      const trainerName = `${workout.video.trainer.name} ${workout.video.trainer.lastName}`;
      const workoutTime = formatWorkoutTime(workout.date);

      const telegramMessage = `🔥 Через 10 минут начнется тренировка!\n\n🎬 ${workout.video.title}\n👤 Тренер: ${trainerName}\n⏱ Длительность: ${Math.round(workout.video.duration / 60)} мин\n📅 ${workoutTime}\n\nВремя размяться! 🏃‍♂️`;

      const channel = await notifyUser(workout.user, {
        title: '🔥 Через 10 минут тренировка',
        body: workout.video.title,
        url: `/video/${workout.video.id}`,
        telegramMessage,
        telegramOptions: {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [{ text: '🚀 Начать тренировку', web_app: { url: `${appUrl}/video/${workout.video.id}` } }],
              [{ text: '📅 Мои тренировки', web_app: { url: `${appUrl}/calendar` } }],
            ],
          },
        },
      });

      if (channel !== 'none') {
        await prisma.scheduledWorkout.update({
          where: { id: workout.id },
          data: { notification10MinSent: true },
        });
        sent10 += 1;
        console.log(`✅ 10-min notification (${channel}) sent to ${workout.user.firstName}`);
      } else {
        console.error(`❌ 10-min notification failed for user ${workout.userId}`);
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      notifications: {
        sent30Min: sent30,
        sent10Min: sent10,
        candidates30Min: workoutsIn30Min.length,
        candidates10Min: workoutsIn10Min.length,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in check-workouts cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
