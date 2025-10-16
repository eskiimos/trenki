import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Создаем хоккейных тренеров
  const trainer1 = await prisma.trainer.create({
    data: {
      name: 'КОНСТАНТИН',
      lastName: 'КОНСТАНТИНОПОЛЬСКИЙ',
      speciality: 'ВРАТАРСКАЯ ПОДГОТОВКА',
      experience: 15,
      rating: 5.0,
      avatar: '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png',
      description: 'Профессиональный тренер вратарей. Экс-игрок КХЛ с 15-летним опытом работы'
    }
  });

  const trainer2 = await prisma.trainer.create({
    data: {
      name: 'АЛЕКСЕЙ',
      lastName: 'МОРОЗОВ',
      speciality: 'ТЕХНИКА КАТАНИЯ',
      experience: 12,
      rating: 4.8,
      avatar: '/avatars/avatar_akb.png',
      description: 'Мастер спорта по хоккею. Специализируется на технике катания и скорости'
    }
  });

  const trainer3 = await prisma.trainer.create({
    data: {
      name: 'ДМИТРИЙ',
      lastName: 'ЗАХАРОВ',
      speciality: 'ТЕХНИКА БРОСКА',
      experience: 8,
      rating: 4.9,
      avatar: '/avatars/avatar AKB.png',
      description: 'Эксперт по технике владения клюшкой и точности бросков'
    }
  });

  // Создаем хоккейные видео тренировки
  await prisma.video.createMany({
    data: [
      {
        title: 'Основы вратарской техники',
        description: 'Изучаем базовые навыки стойки и передвижения в воротах',
        duration: 180,
        videoUrl: '/video/trenka.mp4',
        thumbnail: '/images/video_prew_2.png',
        category: 'GOALKEEPER',
        difficulty: 'BEGINNER',
        trainerId: trainer1.id
      },
      {
        title: 'Техника ловли шайбы',
        description: 'Отработка различных способов ловли и отбивания шайбы',
        duration: 240,
        videoUrl: '/video/shots/short_1.mp4',
        thumbnail: '/images/preview_shorts/shorts_1.png',
        category: 'GOALKEEPER',
        difficulty: 'INTERMEDIATE',
        trainerId: trainer1.id
      },
      {
        title: 'Техника катания - повороты',
        description: 'Изучаем правильную технику поворотов на коньках',
        duration: 300,
        videoUrl: '/video/shots/short_2.mp4',
        thumbnail: '/images/preview_shorts/shorts_2.png',
        category: 'SKATING',
        difficulty: 'BEGINNER',
        trainerId: trainer2.id
      },
      {
        title: 'Скоростное катание',
        description: 'Развитие скорости катания и стартовых ускорений',
        duration: 450,
        videoUrl: '/video/shots/short_3.mp4',
        thumbnail: '/images/preview_shorts/shorts_3.png',
        category: 'SPEED',
        difficulty: 'INTERMEDIATE',
        trainerId: trainer2.id
      },
      {
        title: 'Техника броска с запястья',
        description: 'Изучаем кистевой бросок - основу хоккейной техники',
        duration: 200,
        videoUrl: '/video/shots/short_4.mp4',
        thumbnail: '/images/preview_shorts/shorts_4.png',
        category: 'SHOOTING',
        difficulty: 'BEGINNER',
        trainerId: trainer3.id
      },
      {
        title: 'Силовые приемы',
        description: 'Техника силового единоборства и отбора шайбы',
        duration: 320,
        videoUrl: '/video/trenka.mp4',
        thumbnail: '/images/video_inbording.png',
        category: 'CHECKING',
        difficulty: 'INTERMEDIATE',
        trainerId: trainer3.id
      },
      {
        title: 'Передачи на ходу',
        description: 'Точность передач во время движения',
        duration: 280,
        videoUrl: '/video/shots/short_2.mp4',
        thumbnail: '/images/preview_shorts/shorts_2.png',
        category: 'PASSING',
        difficulty: 'ADVANCED',
        trainerId: trainer3.id
      }
    ]
  });

  // Создаем тестового хоккеиста (с учетом того что может уже существовать)
  const testUserData = await prisma.user.upsert({
    where: { telegramId: '123456789' },
    update: {
      firstName: 'Константин',
      lastName: 'Константинопольский',
      username: 'goalie_88',
    },
    create: {
      telegramId: '123456789',
      firstName: 'Константин',
      lastName: 'Константинопольский',
      username: 'goalie_88',
      profile: {
        create: {
          position: 'GOALTENDER',
          number: 88,
          age: 24,
          gender: 'MALE',
          height: 185,
          weight: 82,
          strength: 78,
          endurance: 85,
          speed: 65,
          technique: 92,
          skating: 70,
          shooting: 45, // Для вратаря не так важно
          passing: 88,
          checking: 60,
          overall: 82,
          dailyProgress: 8,
          maxDailyGoal: 10
        }
      }
    }
  });

  // Добавляем ещё тестовых хоккеистов
  await prisma.user.upsert({
    where: { telegramId: '987654321' },
    update: {
      firstName: 'Александр',
      lastName: 'Овечкин',
      username: 'alex_ovi',
    },
    create: {
      telegramId: '987654321',
      firstName: 'Александр',
      lastName: 'Овечкин',
      username: 'alex_ovi',
      profile: {
        create: {
          position: 'LEFT_WING',
          number: 8,
          age: 28,
          gender: 'MALE',
          height: 191,
          weight: 107,
          strength: 95,
          endurance: 78,
          speed: 85,
          technique: 88,
          skating: 82,
          shooting: 98,
          passing: 84,
          checking: 90,
          overall: 88,
          dailyProgress: 5,
          maxDailyGoal: 10
        }
      }
    }
  });

  await prisma.user.upsert({
    where: { telegramId: '456789123' },
    update: {
      firstName: 'Никита',
      lastName: 'Кучеров',
      username: 'kuch_86',
    },
    create: {
      telegramId: '456789123',
      firstName: 'Никита',
      lastName: 'Кучеров',
      username: 'kuch_86',
      profile: {
        create: {
          position: 'RIGHT_WING',
          number: 86,
          age: 25,
          gender: 'MALE',
          height: 180,
          weight: 82,
          strength: 72,
          endurance: 85,
          speed: 88,
          technique: 95,
          skating: 90,
          shooting: 92,
          passing: 96,
          checking: 65,
          overall: 85,
          dailyProgress: 7,
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
