/**
 * ВРЕМЕННЫЙ скрипт для тестирования
 * Добавляет дополнительные LoadType теги существующим видео
 */

import { PrismaClient, LoadType } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function addTestLoadTypes() {
  console.log('🧪 Добавляем тестовые LoadType теги для проверки генерации\n');

  try {
    // Видео "Упражнения на КАТАНИЕ" → добавим TECHNICAL_SKILL
    const video1 = await prisma.video.findFirst({
      where: { title: { contains: 'КАТАНИЕ' } }
    });

    if (video1) {
      let tag1 = await prisma.tag.findFirst({
        where: { tagType: 'LOAD', loadType: LoadType.TECHNICAL_SKILL }
      });

      if (!tag1) {
        tag1 = await prisma.tag.create({
          data: {
            name: 'LoadType:TECHNICAL_SKILL',
            displayName: 'Технические навыки',
            tagType: 'LOAD',
            loadType: LoadType.TECHNICAL_SKILL,
          }
        });
      }

      await prisma.videoTag.upsert({
        where: {
          videoId_tagId: {
            videoId: video1.id,
            tagId: tag1.id
          }
        },
        create: {
          videoId: video1.id,
          tagId: tag1.id
        },
        update: {}
      });

      console.log('✅ "Упражнения на КАТАНИЕ" → TECHNICAL_SKILL');
    }

    // Видео "дриблинг" → добавим AGILITY
    const video2 = await prisma.video.findFirst({
      where: { title: { contains: 'дриблинг' } }
    });

    if (video2) {
      let tag2 = await prisma.tag.findFirst({
        where: { tagType: 'LOAD', loadType: LoadType.AGILITY }
      });

      if (!tag2) {
        tag2 = await prisma.tag.create({
          data: {
            name: 'LoadType:AGILITY',
            displayName: 'Ловкость',
            tagType: 'LOAD',
            loadType: LoadType.AGILITY,
          }
        });
      }

      await prisma.videoTag.upsert({
        where: {
          videoId_tagId: {
            videoId: video2.id,
            tagId: tag2.id
          }
        },
        create: {
          videoId: video2.id,
          tagId: tag2.id
        },
        update: {}
      });

      console.log('✅ "дриблинг" → AGILITY');
    }

    // Видео "Разминка для хоккеистов" → добавим DYNAMIC_STRETCH
    const video3 = await prisma.video.findFirst({
      where: { title: { contains: 'Разминка для хоккеистов' } }
    });

    if (video3) {
      let tag3 = await prisma.tag.findFirst({
        where: { tagType: 'LOAD', loadType: LoadType.DYNAMIC_STRETCH }
      });

      if (!tag3) {
        tag3 = await prisma.tag.create({
          data: {
            name: 'LoadType:DYNAMIC_STRETCH',
            displayName: 'Динамическая растяжка',
            tagType: 'LOAD',
            loadType: LoadType.DYNAMIC_STRETCH,
          }
        });
      }

      await prisma.videoTag.upsert({
        where: {
          videoId_tagId: {
            videoId: video3.id,
            tagId: tag3.id
          }
        },
        create: {
          videoId: video3.id,
          tagId: tag3.id
        },
        update: {}
      });

      console.log('✅ "Разминка для хоккеистов" → DYNAMIC_STRETCH');
    }

    console.log('\n✅ Тестовые теги добавлены!');
    console.log('💡 Теперь можно попробовать сгенерировать тренировку.');
    console.log('⚠️  ВНИМАНИЕ: Это временное решение для теста!');
    console.log('   В будущем добавьте больше видео через админку.\n');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestLoadTypes();
