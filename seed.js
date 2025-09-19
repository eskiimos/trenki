const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  try {
    // Создаем тестового пользователя
    const user = await prisma.user.create({
      data: {
        id: 'clu12347',
        telegramId: '987654322'
      }
    });
    console.log('Created user:', user);

    // Создаем профиль для пользователя
    const profile = await prisma.profile.create({
      data: {
        id: 'clp12347',
        userId: user.id,
        strength: 20,
        endurance: 15,
        speed: 25,
        technique: 30,
        overall: 22,
        dailyProgress: 5,
        maxDailyGoal: 10
      }
    });
    console.log('Created profile:', profile);

    // Создаем тренера
    const trainer = await prisma.trainer.create({
      data: {
        id: 'clt12347',
        name: 'Алексей',
        lastName: 'Иванов',
        speciality: 'Хоккей',
        experience: 7,
        rating: 4.9,
        description: 'Профессиональный тренер по хоккею'
      }
    });
    console.log('Created trainer:', trainer);

    // Создаем видео
    const video = await prisma.video.create({
      data: {
        id: 'clv12347',
        title: 'Техника катания на коньках',
        description: 'Базовые упражнения для начинающих хоккеистов',
        duration: 900,
        videoUrl: '/videos/skating.mp4',
        category: 'SPEED',
        difficulty: 'BEGINNER',
        trainerId: trainer.id
      }
    });
    console.log('Created video:', video);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
