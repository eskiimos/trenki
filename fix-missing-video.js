const { PrismaClient, ModuleType } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function fixVideo() {
  try {
    // Исправляем видео "11 Скорость+ноги" - это явно FITNESS
    await prisma.video.updateMany({
      where: {
        title: { contains: '11 Скорость+ноги' }
      },
      data: {
        moduleType: ModuleType.FITNESS
      }
    });
    
    console.log('✅ Видео "11 Скорость+ноги" обновлено: moduleType = FITNESS');
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixVideo();
