/**
 * Скрипт для автоматического присвоения LoadType тегов существующим видео
 * На основе названий и описаний
 */

import { PrismaClient, LoadType } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

// Маппинг LoadType → Русские названия типов нагрузки
const LOADTYPE_RU_MAPPING: Record<LoadType, string[]> = {
  [LoadType.SPEED]: ['скорость', 'sprint', 'быстр'],
  [LoadType.POWER]: ['мощность', 'взрыв', 'power', 'плио'],
  [LoadType.MAX_STRENGTH]: ['сила', 'strength', 'максимальн'],
  [LoadType.STRENGTH_ENDURANCE]: ['силовая выносливость', 'силовая'],
  [LoadType.ANAEROBIC_ENDURANCE]: ['анаэробн', 'интервал', 'виит', 'hiit'],
  [LoadType.AEROBIC_ENDURANCE]: ['аэробн', 'выносливость', 'cardio', 'кардио'],
  [LoadType.AGILITY]: ['ловкость', 'координация', 'agility', 'баланс'],
  [LoadType.MOBILITY]: ['мобильность', 'mobility', 'разминка', 'warmup'],
  [LoadType.TECHNICAL_SKILL]: ['техника', 'дриблинг', 'skill', 'катание'],
  [LoadType.STATIC_STRETCH]: ['растяжка', 'stretch', 'стрейч', 'заминка'],
  [LoadType.DYNAMIC_STRETCH]: ['динамическая растяжка', 'dynamic stretch'],
  [LoadType.PREHAB]: ['лфк', 'профилактика', 'prehab', 'реабилитация'],
};

// Русское отображение LoadType
const LOADTYPE_DISPLAY: Record<LoadType, string> = {
  [LoadType.SPEED]: 'Скорость',
  [LoadType.POWER]: 'Мощность',
  [LoadType.MAX_STRENGTH]: 'Максимальная сила',
  [LoadType.STRENGTH_ENDURANCE]: 'Силовая выносливость',
  [LoadType.ANAEROBIC_ENDURANCE]: 'Анаэробная выносливость',
  [LoadType.AEROBIC_ENDURANCE]: 'Аэробная выносливость',
  [LoadType.AGILITY]: 'Ловкость',
  [LoadType.MOBILITY]: 'Мобильность',
  [LoadType.TECHNICAL_SKILL]: 'Технические навыки',
  [LoadType.STATIC_STRETCH]: 'Статическая растяжка',
  [LoadType.DYNAMIC_STRETCH]: 'Динамическая растяжка',
  [LoadType.PREHAB]: 'ЛФК (профилактика)',
};

async function assignLoadTypes() {
  try {
    console.log('🚀 Начинаем присвоение LoadType тегов существующим видео\n');

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

    console.log(`📹 Найдено видео: ${videos.length}\n`);

    let processed = 0;
    let tagged = 0;

    for (const video of videos) {
      const text = `${video.title} ${video.description || ''}`.toLowerCase();
      
      // Находим подходящий LoadType
      let assignedLoadType: LoadType | null = null;
      
      for (const [loadType, keywords] of Object.entries(LOADTYPE_RU_MAPPING)) {
        if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
          assignedLoadType = loadType as LoadType;
          break;
        }
      }

      // Если LoadType определен, создаем тег
      if (assignedLoadType) {
        // Проверяем, есть ли уже LoadType тег у видео
        const hasLoadTypeTag = video.videoTags.some(
          vt => vt.tag.tagType === 'LOAD' && vt.tag.loadType
        );

        if (!hasLoadTypeTag) {
          // Создаем или находим тег
          const tagName = `LoadType:${assignedLoadType}`;
          
          let tag = await prisma.tag.findFirst({
            where: {
              tagType: 'LOAD',
              loadType: assignedLoadType
            }
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: {
                name: tagName,
                displayName: LOADTYPE_DISPLAY[assignedLoadType],
                tagType: 'LOAD',
                loadType: assignedLoadType,
              }
            });
          }

          // Связываем тег с видео
          await prisma.videoTag.create({
            data: {
              videoId: video.id,
              tagId: tag.id
            }
          });

          console.log(`✅ "${video.title}"`);
          console.log(`   → Добавлен LoadType: ${LOADTYPE_DISPLAY[assignedLoadType]}\n`);
          tagged++;
        } else {
          console.log(`⏭️  "${video.title}" - уже есть LoadType тег`);
        }
      } else {
        console.log(`⚠️  "${video.title}" - не удалось определить LoadType`);
      }

      processed++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n📊 ИТОГО:`);
    console.log(`   Обработано видео: ${processed}`);
    console.log(`   Добавлено тегов: ${tagged}`);
    console.log(`\n✅ Готово!`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignLoadTypes();
