const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Создаем тренеров
  const trainer1 = await prisma.trainer.create({
    data: {
      name: 'КОНСТАНТИН',
      lastName: 'КОНСТАНТИНОПОЛЬСКИЙ',
      speciality: 'ВРАТАРСКАЯ ПОДГОТОВКА',
      experience: 15,
      rating: 5.0,
      avatar: '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png',
      description: 'Профессиональный тренер по вратарской подготовке с 15-летним опытом работы'
    }
  });

  const trainer2 = await prisma.trainer.create({
    data: {
      name: 'СЕРГЕЙ',
      lastName: 'ПЕТРОВ',
      speciality: 'ТАКТИЧЕСКАЯ ПОДГОТОВКА',
      experience: 12,
      rating: 4.8,
      avatar: '/avatars/avatar_akb.png',
      description: 'Специалист по тактической подготовке и командной игре'
    }
  });

  const trainer3 = await prisma.trainer.create({
    data: {
      name: 'АННА',
      lastName: 'ИВАНОВА',
      speciality: 'ФИЗИЧЕСКАЯ ПОДГОТОВКА',
      experience: 8,
      rating: 4.9,
      avatar: '/avatars/avatar AKB.png',
      description: 'Эксперт по физической подготовке и развитию выносливости'
    }
  });

  // Создаем видео для тренеров
  await prisma.video.createMany({
    data: [
      {
        title: 'Основы вратарской техники',
        description: 'Изучаем базовые навыки голкипера',
        duration: 180,
        videoUrl: '/video/trenka.mp4',
        thumbnail: '/images/video_prew_2.png',
        category: 'GOALKEEPER',
        difficulty: 'BEGINNER',
        trainerId: trainer1.id
      },
      {
        title: 'Продвинутые приемы вратаря',
        description: 'Сложные техники для опытных вратарей',
        duration: 240,
        videoUrl: '/video/shots/short_1.mp4',
        thumbnail: '/images/preview_shorts/shorts_1.png',
        category: 'GOALKEEPER',
        difficulty: 'ADVANCED',
        trainerId: trainer1.id
      },
      {
        title: 'Тактические схемы 4-4-2',
        description: 'Разбираем классическую схему игры',
        duration: 300,
        videoUrl: '/video/shots/short_2.mp4',
        thumbnail: '/images/preview_shorts/shorts_2.png',
        category: 'TACTICAL',
        difficulty: 'INTERMEDIATE',
        trainerId: trainer2.id
      },
      {
        title: 'Функциональная тренировка',
        description: 'Комплексная физическая подготовка',
        duration: 450,
        videoUrl: '/video/shots/short_3.mp4',
        thumbnail: '/images/preview_shorts/shorts_3.png',
        category: 'STRENGTH',
        difficulty: 'INTERMEDIATE',
        trainerId: trainer3.id
      },
      {
        title: 'Развитие выносливости',
        description: 'Кардио-тренировка для футболистов',
        duration: 360,
        videoUrl: '/video/shots/short_4.mp4',
        thumbnail: '/images/preview_shorts/shorts_4.png',
        category: 'ENDURANCE',
        difficulty: 'BEGINNER',
        trainerId: trainer3.id
      }
    ]
  });

  // Создаем тестового пользователя
  const testUser = await prisma.user.create({
    data: {
      telegramId: '123456789',
      firstName: 'Евгений',
      lastName: 'Евгеньев',
      username: 'test_user',
      profile: {
        create: {
          position: 'Нападающий',
          number: 11,
          age: 10,
          height: 134,
          weight: 42,
          strength: 16,
          endurance: 22,
          speed: 55,
          technique: 22,
          overall: 28,
          dailyProgress: 8,
          maxDailyGoal: 10
        }
      }
    }
  });

  console.log('Database seeded successfully!');
  console.log(`Created ${await prisma.trainer.count()} trainers`);
  console.log(`Created ${await prisma.video.count()} videos`);
  console.log(`Created ${await prisma.user.count()} users`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
