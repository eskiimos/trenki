import { PrismaClient, LoadType } from '../src/generated/prisma';

const prisma = new PrismaClient();

/**
 * Скрипт для добавления LoadType тегов к существующим видео
 * Запуск: npx tsx prisma/add-load-type-tags.ts
 */

async function main() {
  console.log('🏒 Добавление LoadType тегов к видео...\n');

  // Получаем все видео
  const videos = await prisma.video.findMany({
    include: {
      videoTags: {
        include: {
          tag: true
        }
      }
    }
  });

  console.log(`Найдено ${videos.length} видео\n`);

  // Маппинг: название видео → LoadType теги
  const videoLoadTypes: Record<string, LoadType[]> = {
    // Вратарские тренировки
    'Основы вратарской техники': [LoadType.AGILITY, LoadType.TECHNICAL_SKILL],
    'Техника ловли шайбы': [LoadType.AGILITY, LoadType.TECHNICAL_SKILL],
    
    // Катание
    'Техника катания - повороты': [LoadType.AGILITY, LoadType.SPEED],
    'Скоростное катание': [LoadType.SPEED, LoadType.ANAEROBIC_ENDURANCE],
    
    // Броски
    'Техника броска с запястья': [LoadType.TECHNICAL_SKILL, LoadType.POWER],
    'Силовые приемы': [LoadType.POWER, LoadType.STRENGTH_ENDURANCE],
    
    // Разминка/растяжка
    'Разминка перед тренировкой': [LoadType.DYNAMIC_STRETCH, LoadType.MOBILITY],
    'Растяжка после игры': [LoadType.STATIC_STRETCH, LoadType.MOBILITY],
    
    // Функциональная подготовка
    'Функциональная подготовка': [LoadType.STRENGTH_ENDURANCE, LoadType.AEROBIC_ENDURANCE],
    'Силовая тренировка': [LoadType.MAX_STRENGTH, LoadType.POWER],
    
    // Кардио
    'Кардио тренировка': [LoadType.AEROBIC_ENDURANCE, LoadType.ANAEROBIC_ENDURANCE],
    
    // Профилактика травм
    'Профилактика травм': [LoadType.PREHAB, LoadType.MOBILITY],
  };

  // Для каждого видео добавляем LoadType теги
  for (const video of videos) {
    const loadTypes = videoLoadTypes[video.title];
    
    if (!loadTypes || loadTypes.length === 0) {
      console.log(`⚠️  "${video.title}" - теги не определены, пропускаем`);
      continue;
    }

    console.log(`📹 "${video.title}"`);

    // Для каждого LoadType создаем или находим тег
    for (const loadType of loadTypes) {
      // Проверяем, есть ли уже такой тег
      const existingTag = await prisma.tag.findFirst({
        where: {
          name: loadType,
          tagType: 'LOAD'
        }
      });

      let tag;
      if (existingTag) {
        tag = existingTag;
        console.log(`   ✓ Тег "${loadType}" уже существует`);
      } else {
        // Генерируем displayName из enum
        const displayName = loadType
          .split('_')
          .map(word => word.charAt(0) + word.slice(1).toLowerCase())
          .join(' ');
        
        tag = await prisma.tag.create({
          data: {
            name: loadType,
            displayName: displayName,
            tagType: 'LOAD',
            loadType: loadType
          }
        });
        console.log(`   + Создан тег "${loadType}" (${displayName})`);
      }

      // Проверяем, есть ли уже связь
      const existingVideoTag = await prisma.videoTag.findFirst({
        where: {
          videoId: video.id,
          tagId: tag.id
        }
      });

      if (!existingVideoTag) {
        await prisma.videoTag.create({
          data: {
            videoId: video.id,
            tagId: tag.id
          }
        });
        console.log(`   → Привязан к видео`);
      } else {
        console.log(`   → Уже привязан к видео`);
      }
    }

    console.log('');
  }

  console.log('✅ Готово!\n');

  // Выводим статистику
  const loadTags = await prisma.tag.findMany({
    where: { tagType: 'LOAD' },
    include: {
      videos: true
    }
  });

  console.log('📊 Статистика LoadType тегов:');
  for (const tag of loadTags) {
    console.log(`   ${tag.name}: ${tag.videos.length} видео`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
