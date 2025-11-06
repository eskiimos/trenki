/**
 * Скрипт для проверки LoadType тегов в базе данных
 * Показывает какие теги созданы и сколько видео к ним привязано
 */

import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

// Маппинг LoadType enum → Русское название
const loadTypeNamesRu: Record<string, string> = {
  'MAX_STRENGTH': 'Максимальная сила',
  'POWER': 'Мощность',
  'SPEED': 'Скорость',
  'STRENGTH_ENDURANCE': 'Силовая выносливость',
  'ANAEROBIC_ENDURANCE': 'Анаэробная выносливость',
  'AEROBIC_ENDURANCE': 'Аэробная выносливость',
  'AGILITY': 'Ловкость',
  'MOBILITY': 'Мобильность',
  'TECHNICAL_SKILL': 'Технические навыки',
  'STATIC_STRETCH': 'Статическая растяжка',
  'DYNAMIC_STRETCH': 'Динамическая растяжка',
  'PREHAB': 'ЛФК (профилактика)',
};

// Маппинг LoadType → Характеристика
const loadTypeToChar: Record<string, string> = {
  'MAX_STRENGTH': '💪 Сила',
  'POWER': '💪 Сила',
  'SPEED': '⚡ Скорость',
  'STRENGTH_ENDURANCE': '🫀 Выносливость',
  'ANAEROBIC_ENDURANCE': '🫀 Выносливость',
  'AEROBIC_ENDURANCE': '🫀 Выносливость',
  'AGILITY': '🎯 Техника',
  'MOBILITY': '🤸 Гибкость',
  'TECHNICAL_SKILL': '🎯 Техника',
  'STATIC_STRETCH': '🤸 Гибкость',
  'DYNAMIC_STRETCH': '🤸 Гибкость',
  'PREHAB': '🤸 Гибкость',
};

async function checkLoadTypeTags() {
  console.log('🔍 ПРОВЕРКА LoadType ТЕГОВ В БАЗЕ ДАННЫХ\n');

  try {
    // Получаем все LoadType теги
    const loadTypeTags = await prisma.tag.findMany({
      where: {
        tagType: 'LOAD',
      },
      include: {
        videos: {
          include: {
            video: {
              select: {
                id: true,
                title: true,
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    if (loadTypeTags.length === 0) {
      console.log('⚠️  LoadType теги не найдены в базе данных');
      return;
    }

    console.log(`✅ Найдено LoadType тегов: ${loadTypeTags.length}\n`);
    console.log('═'.repeat(80));

    loadTypeTags.forEach((tag) => {
      // Извлекаем LoadType enum из имени тега (например, "LoadType:POWER" → "POWER")
      const loadTypeEnum = tag.loadType || tag.name.replace('LoadType:', '');
      const ruName = loadTypeNamesRu[loadTypeEnum] || loadTypeEnum;
      const charName = loadTypeToChar[loadTypeEnum] || '❓';

      console.log(`\n📦 ${tag.name}`);
      console.log(`   🏷️  Русское название: ${ruName}`);
      console.log(`   🎯 Развивает: ${charName}`);
      console.log(`   📹 Видео: ${tag.videos.length} шт.`);
      
      if (tag.videos.length > 0) {
        console.log(`   Список видео:`);
        tag.videos.forEach((videoTag, idx) => {
          console.log(`      ${idx + 1}. ${videoTag.video.title}`);
        });
      } else {
        console.log(`   ⚠️  Нет видео с этим типом нагрузки`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 СТАТИСТИКА ПО ХАРАКТЕРИСТИКАМ:\n');

    // Группируем по характеристикам
    const charStats: Record<string, { count: number; types: string[] }> = {};

    loadTypeTags.forEach((tag) => {
      const loadTypeEnum = tag.loadType || tag.name.replace('LoadType:', '');
      const charName = loadTypeToChar[loadTypeEnum] || '❓';
      
      if (!charStats[charName]) {
        charStats[charName] = { count: 0, types: [] };
      }
      
      charStats[charName].count += tag.videos.length;
      charStats[charName].types.push(loadTypeNamesRu[loadTypeEnum] || loadTypeEnum);
    });

    Object.entries(charStats).forEach(([char, stats]) => {
      console.log(`${char}`);
      console.log(`   Всего видео: ${stats.count}`);
      console.log(`   Типы нагрузки: ${stats.types.join(', ')}`);
      console.log('');
    });

    // Проверяем недостающие типы для алгоритма
    console.log('═'.repeat(80));
    console.log('\n⚠️  РЕКОМЕНДАЦИИ ДЛЯ ГЕНЕРАЦИИ ТРЕНИРОВОК:\n');

    const warmupTypes = ['MOBILITY', 'DYNAMIC_STRETCH'];
    const cooldownTypes = ['STATIC_STRETCH', 'MOBILITY'];

    warmupTypes.forEach(type => {
      const tag = loadTypeTags.find(t => t.loadType === type || t.name.includes(type));
      const ruName = loadTypeNamesRu[type];
      if (!tag || tag.videos.length === 0) {
        console.log(`❌ Недостаточно видео для РАЗМИНКИ: ${ruName} (${type})`);
      } else {
        console.log(`✅ Разминка ${ruName}: ${tag.videos.length} видео`);
      }
    });

    cooldownTypes.forEach(type => {
      const tag = loadTypeTags.find(t => t.loadType === type || t.name.includes(type));
      const ruName = loadTypeNamesRu[type];
      if (!tag || tag.videos.length === 0) {
        console.log(`❌ Недостаточно видео для ЗАМИНКИ: ${ruName} (${type})`);
      } else {
        console.log(`✅ Заминка ${ruName}: ${tag.videos.length} видео`);
      }
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLoadTypeTags();
