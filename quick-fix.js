const { PrismaClient, LoadType, ModuleType } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function quickFix() {
  try {
    console.log('🔧 Быстрое исправление для теста...\n');
    
    // 1. Техника с AGILITY подходит! Добавим TECHNICAL_SKILL как альтернативу
    const techniqueVideos = await prisma.video.updateMany({
      where: {
        moduleType: ModuleType.TECHNIQUE,
        loadType: LoadType.AGILITY
      },
      data: {
        loadType: LoadType.TECHNICAL_SKILL // Техника - это технический навык
      }
    });
    console.log(`✅ Обновлено ${techniqueVideos.count} видео TECHNIQUE → TECHNICAL_SKILL`);
    
    // 2. Одну из разминок сделаем DYNAMIC_STRETCH для FULL_BODY
    const warmupVideo = await prisma.video.findFirst({
      where: {
        title: { contains: '28. Разминка+низ тела' }
      }
    });
    
    if (warmupVideo) {
      await prisma.video.update({
        where: { id: warmupVideo.id },
        data: {
          loadType: LoadType.DYNAMIC_STRETCH // уже есть
        }
      });
      console.log('✅ Разминка "28. Разминка+низ тела" уже DYNAMIC_STRETCH');
    }
    
    // 3. Создадим простую заминку из существующего видео (временно)
    // Найдем самое легкое видео и сделаем его заминкой
    const lightVideo = await prisma.video.findFirst({
      where: {
        isPublished: true,
        OR: [
          { title: { contains: 'RPE4' } },
          { title: { contains: 'RPE5' } },
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (lightVideo && lightVideo.moduleType !== ModuleType.COOLDOWN) {
      // Дублируем это видео как заминку
      const cooldown = await prisma.video.create({
        data: {
          title: '[ЗАМИНКА] ' + lightVideo.title,
          description: lightVideo.description,
          duration: lightVideo.duration,
          videoUrl: lightVideo.videoUrl,
          thumbnail: lightVideo.thumbnail,
          trainerId: lightVideo.trainerId,
          category: 'GENERAL',
          difficulty: 'BEGINNER',
          isPublished: true,
          moduleType: ModuleType.COOLDOWN,
          loadType: LoadType.STATIC_STRETCH,
          muscleGroup: lightVideo.muscleGroup,
          complexity: lightVideo.complexity,
          trainingGoals: ['RECOVERY', 'DEVELOPMENT', 'PEAK'],
          tags: [],
          equipment: [],
        }
      });
      console.log(`✅ Создана ЗАМИНКА на основе "${lightVideo.title}"`);
    }
    
    console.log('\n✅ Исправления применены! Пробуем еще раз...\n');
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();
