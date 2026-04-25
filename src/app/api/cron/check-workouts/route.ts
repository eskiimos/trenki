import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage, formatWorkoutTime } from '@/lib/telegram';

/**
 * API для проверки запланированных тренировок и отправки уведомлений
 * Должен вызываться каждую минуту через cron job
 * 
 * Vercel Cron: https://vercel.com/docs/cron-jobs
 * Добавьте в vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-workouts",
 *     "schedule": "* * * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Проверяем authorization header (для безопасности)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('❌ CRON_SECRET не задан в env');
      return NextResponse.json(
        { error: 'Cron is not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    console.log(`🕐 Checking scheduled workouts at ${now.toISOString()}`);

    // Получаем тренировки на ближайшие 35 минут (чтобы захватить 30-минутное окно)
    const in35Minutes = new Date(now.getTime() + 35 * 60 * 1000);
    const in25Minutes = new Date(now.getTime() + 25 * 60 * 1000);
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    const in5Minutes = new Date(now.getTime() + 5 * 60 * 1000);

    // ========== Уведомления за 30 минут ==========
    const workoutsIn30Min = await prisma.scheduledWorkout.findMany({
      where: {
        date: {
          gte: in25Minutes,
          lte: in35Minutes,
        },
        notification30MinSent: false,
        completed: false,
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          }
        },
        video: {
          select: {
            id: true,
            title: true,
            duration: true,
            trainer: {
              select: {
                name: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    console.log(`📢 Found ${workoutsIn30Min.length} workouts starting in ~30 minutes`);

    for (const workout of workoutsIn30Min) {
      const trainerName = `${workout.video.trainer.name} ${workout.video.trainer.lastName}`;
      const workoutTime = formatWorkoutTime(workout.date);
      
      const message = `⏰ Через 30 минут начнется тренировка!

🎬 ${workout.video.title}
👤 Тренер: ${trainerName}
⏱ Длительность: ${Math.round(workout.video.duration / 60)} мин
📅 ${workoutTime}

Начни готовиться! 💪`;

      const result = await sendTelegramMessage(workout.user.telegramId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Начать тренировку',
                web_app: { url: `${process.env.WEB_APP_URL}/video/${workout.video.id}` || `https://trenki.vercel.app/video/${workout.video.id}` }
              }
            ],
            [
              {
                text: '📅 Мои тренировки',
                web_app: { url: `${process.env.WEB_APP_URL}/calendar` || `https://trenki.vercel.app/calendar` }
              }
            ]
          ]
        }
      });

      if (result.success) {
        await prisma.scheduledWorkout.update({
          where: { id: workout.id },
          data: { notification30MinSent: true }
        });
        console.log(`✅ 30-min notification sent to ${workout.user.firstName}`);
      } else {
        console.error(`❌ Failed to send 30-min notification to ${workout.user.telegramId}:`, result.error);
      }
    }

    // ========== Уведомления за 10 минут ==========
    const workoutsIn10Min = await prisma.scheduledWorkout.findMany({
      where: {
        date: {
          gte: in5Minutes,
          lte: in15Minutes,
        },
        notification10MinSent: false,
        completed: false,
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
          }
        },
        video: {
          select: {
            id: true,
            title: true,
            duration: true,
            trainer: {
              select: {
                name: true,
                lastName: true,
              }
            }
          }
        }
      }
    });

    console.log(`📢 Found ${workoutsIn10Min.length} workouts starting in ~10 minutes`);

    for (const workout of workoutsIn10Min) {
      const trainerName = `${workout.video.trainer.name} ${workout.video.trainer.lastName}`;
      const workoutTime = formatWorkoutTime(workout.date);
      
      const message = `🔥 Через 10 минут начнется тренировка!

🎬 ${workout.video.title}
👤 Тренер: ${trainerName}
⏱ Длительность: ${Math.round(workout.video.duration / 60)} мин
📅 ${workoutTime}

Время размяться! 🏃‍♂️`;

      const result = await sendTelegramMessage(workout.user.telegramId, message, {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Начать тренировку',
                web_app: { url: `${process.env.WEB_APP_URL}/video/${workout.video.id}` || `https://trenki.vercel.app/video/${workout.video.id}` }
              }
            ],
            [
              {
                text: '📅 Мои тренировки',
                web_app: { url: `${process.env.WEB_APP_URL}/calendar` || `https://trenki.vercel.app/calendar` }
              }
            ]
          ]
        }
      });

      if (result.success) {
        await prisma.scheduledWorkout.update({
          where: { id: workout.id },
          data: { notification10MinSent: true }
        });
        console.log(`✅ 10-min notification sent to ${workout.user.firstName}`);
      } else {
        console.error(`❌ Failed to send 10-min notification to ${workout.user.telegramId}:`, result.error);
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      notifications: {
        sent30Min: workoutsIn30Min.length,
        sent10Min: workoutsIn10Min.length,
      }
    });

  } catch (error: any) {
    console.error('❌ Error in check-workouts cron:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
