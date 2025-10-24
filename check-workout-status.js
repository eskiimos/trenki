const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkWorkoutStatus() {
  try {
    // Получаем последнюю незавершенную тренировку
    const workout = await prisma.workoutSession.findFirst({
      where: {
        status: {
          in: ['PENDING', 'IN_PROGRESS'],
        },
      },
      include: {
        videos: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!workout) {
      console.log('❌ Нет активных тренировок');
      return;
    }

    console.log('📊 Текущая тренировка:');
    console.log('ID:', workout.id);
    console.log('Status:', workout.status);
    console.log('Current Video Index:', workout.currentVideoIndex);
    console.log('Total Videos:', workout.totalVideos);
    console.log('\n📹 Видео в тренировке:');
    
    workout.videos.forEach((video, index) => {
      console.log(`\n${index + 1}. Order: ${video.order}`);
      console.log('   Video ID:', video.videoId);
      console.log('   Completed:', video.completed ? '✅' : '❌');
      console.log('   Started At:', video.startedAt || 'не начато');
      console.log('   Completed At:', video.completedAt || 'не завершено');
    });

    const completedCount = workout.videos.filter(v => v.completed).length;
    console.log(`\n📈 Прогресс: ${completedCount}/${workout.totalVideos} видео завершено`);

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkoutStatus();
