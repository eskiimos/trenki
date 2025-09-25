// Скрипт для заполнения базы данных тренерами
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedTrainers() {
  try {
    console.log('Создание тренеров...');
    
    // Тренер 1
    const trainer1 = await prisma.trainer.upsert({
      where: { id: 'trainer1' },
      update: {},
      create: {
        id: 'trainer1',
        name: 'КОНСТАНТИН',
        lastName: 'КОНСТАНТИНОПОЛЬСКИЙ',
        speciality: 'ВРАТАРСКИЙ ТРЕНЕР',
        experience: 15,
        rating: 5.0,
        avatar: '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png',
        description: 'Профессиональный вратарский тренер с 15-летним опытом работы. Специализируется на развитии техники игры вратарей всех уровней подготовки.',
      },
    });

    // Тренер 2
    const trainer2 = await prisma.trainer.upsert({
      where: { id: 'trainer2' },
      update: {},
      create: {
        id: 'trainer2',
        name: 'АННА',
        lastName: 'ПЕТРОВА',
        speciality: 'ФИЗИЧЕСКАЯ ПОДГОТОВКА',
        experience: 10,
        rating: 4.8,
        avatar: '/avatars/avatar_akb.png',
        description: 'Эксперт по физической подготовке хоккеистов. Разработка индивидуальных программ тренировок для повышения выносливости и силы.',
      },
    });

    // Тренер 3
    const trainer3 = await prisma.trainer.upsert({
      where: { id: 'trainer3' },
      update: {},
      create: {
        id: 'trainer3',
        name: 'МИХАИЛ',
        lastName: 'СМИРНОВ',
        speciality: 'ТЕХНИКА КАТАНИЯ',
        experience: 12,
        rating: 4.9,
        avatar: '/avatars/hockey-player-in-motion-with-a-stick-white-background.png',
        description: 'Специалист по технике катания на коньках. Помогает игрокам улучшить скорость, маневренность и контроль на льду.',
      },
    });

    console.log('Тренеры созданы успешно!');
    console.log('Тренер 1:', trainer1);
    console.log('Тренер 2:', trainer2);
    console.log('Тренер 3:', trainer3);
    
  } catch (error) {
    console.error('Ошибка при создании тренеров:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTrainers();