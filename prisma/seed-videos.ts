import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаем заполнение базы данных...');

  // Создаем тренеров
  const trainer1 = await prisma.trainer.upsert({
    where: { id: 'trainer-1' },
    update: {},
    create: {
      id: 'trainer-1',
      name: 'Иван',
      lastName: 'Иванов',
      speciality: 'Техника катания',
      experience: 10,
      rating: 4.8,
      avatar: '/images/avatars/trainer-avatar-1.png',
      description: 'Опытный тренер по хоккею с 10-летним стажем',
    },
  });

  const trainer2 = await prisma.trainer.upsert({
    where: { id: 'trainer-2' },
    update: {},
    create: {
      id: 'trainer-2',
      name: 'Петр',
      lastName: 'Петров',
      speciality: 'Вратарская подготовка',
      experience: 8,
      rating: 4.9,
      avatar: '/images/avatars/trainer-avatar-1.png',
      description: 'Специалист по подготовке вратарей',
    },
  });

  const trainer3 = await prisma.trainer.upsert({
    where: { id: 'trainer-3' },
    update: {},
    create: {
      id: 'trainer-3',
      name: 'Мария',
      lastName: 'Смирнова',
      speciality: 'Физическая подготовка',
      experience: 7,
      rating: 4.7,
      avatar: '/images/avatars/trainer-avatar-1.png',
      description: 'Эксперт по физической подготовке хоккеистов',
    },
  });

  console.log('Тренеры созданы:', { trainer1, trainer2, trainer3 });

  // Создаем видео
  const video1 = await prisma.video.upsert({
    where: { id: 'video-1' },
    update: {},
    create: {
      id: 'video-1',
      title: 'Основы техники катания',
      description: 'Изучаем базовые элементы техники катания на коньках',
      duration: 524, // 8:44 в секундах
      videoUrl: 'https://example.com/video1.mp4',
      thumbnail: '/images/video_prew_2.png',
      category: 'SKATING',
      difficulty: 'BEGINNER',
      trainerId: trainer1.id,
      tags: ['Техника', 'Катание', 'Основы', 'Новичок'],
      equipment: ['Коньки', 'Шлем', 'Защита'],
      level: 'Начальный',
      isPublished: true,
    },
  });

  const video2 = await prisma.video.upsert({
    where: { id: 'video-2' },
    update: {},
    create: {
      id: 'video-2',
      title: 'Тренировка вратаря',
      description: 'Специальные упражнения для развития вратарских навыков',
      duration: 524,
      videoUrl: 'https://example.com/video2.mp4',
      thumbnail: '/images/video_prew_2.png',
      category: 'GOALKEEPER',
      difficulty: 'INTERMEDIATE',
      trainerId: trainer2.id,
      tags: ['Вратарь', 'Защита', 'Реакция', 'Позиция'],
      equipment: ['Вратарская экипировка', 'Щитки', 'Блины'],
      level: 'Средний',
      isPublished: true,
    },
  });

  const video3 = await prisma.video.upsert({
    where: { id: 'video-3' },
    update: {},
    create: {
      id: 'video-3',
      title: 'Силовая подготовка',
      description: 'Комплекс упражнений для развития силы и выносливости',
      duration: 920, // 15:20
      videoUrl: 'https://example.com/video3.mp4',
      thumbnail: '/images/video_prew_2.png',
      category: 'STRENGTH',
      difficulty: 'ADVANCED',
      trainerId: trainer3.id,
      tags: ['Сила', 'Выносливость', 'Фитнес', 'Тренажерный зал'],
      equipment: ['Штанга', 'Гантели', 'Тренажеры'],
      level: 'Продвинутый',
      isPublished: true,
    },
  });

  const video4 = await prisma.video.upsert({
    where: { id: 'video-4' },
    update: {},
    create: {
      id: 'video-4',
      title: 'Техника броска',
      description: 'Осваиваем правильную технику выполнения бросков',
      duration: 654,
      videoUrl: 'https://example.com/video4.mp4',
      thumbnail: '/images/video_prew_2.png',
      category: 'SHOOTING',
      difficulty: 'INTERMEDIATE',
      trainerId: trainer1.id,
      tags: ['Бросок', 'Техника', 'Щелчок', 'Кистевой'],
      equipment: ['Клюшка', 'Шайба'],
      level: 'Средний',
      isPublished: true,
    },
  });

  console.log('Видео созданы:', { video1, video2, video3, video4 });

  console.log('База данных успешно заполнена!');
}

main()
  .catch((e) => {
    console.error('Ошибка при заполнении базы данных:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
