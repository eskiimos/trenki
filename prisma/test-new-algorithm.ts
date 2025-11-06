import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function testNewAlgorithm() {
  try {
    console.log('🧪 ТЕСТ НОВОГО АЛГОРИТМА ГЕНЕРАЦИИ (LoadType-based)\n');
    console.log('='.repeat(70));
    
    // Находим пользователя с характеристиками
    const profile = await prisma.profile.findFirst({
      where: {
        potential: { gt: 0 }
      },
      select: {
        userId: true,
        ratingPower: true,
        ratingSpeed: true,
        ratingEndurance: true,
        ratingTechnique: true,
        ratingFlexibility: true,
        potential: true,
        user: {
          select: {
            telegramId: true
          }
        }
      }
    });

    if (!profile) {
      console.log('⚠️  Пользователь с характеристиками не найден');
      return;
    }

    console.log(`\n👤 Пользователь: ${profile.user.telegramId}`);
    console.log(`   Потенциал: ${profile.potential}\n`);

    // Показываем характеристики
    const characteristics = {
      POWER: profile.ratingPower,
      SPEED: profile.ratingSpeed,
      ENDURANCE: profile.ratingEndurance,
      TECHNIQUE: profile.ratingTechnique,
      FLEXIBILITY: profile.ratingFlexibility,
    };

    console.log('📊 Характеристики пользователя:');
    Object.entries(characteristics).forEach(([key, value]) => {
      const emoji = {
        POWER: '💪',
        SPEED: '⚡',
        ENDURANCE: '🫀',
        TECHNIQUE: '🎯',
        FLEXIBILITY: '🤸',
      }[key];
      console.log(`   ${emoji} ${key.padEnd(12)} ${value.toFixed(1)}`);
    });

    // Находим слабую характеристику
    const sorted = Object.entries(characteristics).sort((a, b) => a[1] - b[1]);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];

    console.log(`\n📉 Слабая: ${weakest[0]} (${weakest[1].toFixed(1)})`);
    console.log(`📈 Сильная: ${strongest[0]} (${strongest[1].toFixed(1)})`);

    // Проверяем видео с LoadType тегами
    console.log('\n🔍 Проверка доступных видео с LoadType тегами:\n');

    const loadTypes = ['MOBILITY', 'DYNAMIC_STRETCH', 'STATIC_STRETCH', 'POWER', 'SPEED', 'AEROBIC_ENDURANCE'];

    for (const loadType of loadTypes) {
      const count = await prisma.video.count({
        where: {
          isPublished: true,
          videoTags: {
            some: {
              tag: {
                tagType: 'LOAD',
                loadType: loadType as any
              }
            }
          }
        }
      });

      const icon = count > 0 ? '✅' : '⚠️';
      console.log(`   ${icon} ${loadType.padEnd(25)} ${count} видео`);
    }

    // Симулируем подбор тренировки
    console.log('\n🎯 Симуляция подбора тренировки:\n');

    // 1. РАЗМИНКА
    const warmup = await prisma.video.findFirst({
      where: {
        isPublished: true,
        duration: { lte: 600 },
        videoTags: {
          some: {
            tag: {
              tagType: 'LOAD',
              loadType: { in: ['MOBILITY', 'DYNAMIC_STRETCH'] as any[] }
            }
          }
        }
      },
      include: {
        trainer: true,
        videoTags: {
          include: { tag: true }
        }
      }
    });

    if (warmup) {
      console.log('   ✅ РАЗМИНКА найдена:');
      console.log(`      "${warmup.title}"`);
      console.log(`      Длительность: ${Math.floor(warmup.duration / 60)} мин`);
      console.log(`      Тренер: ${warmup.trainer.name} ${warmup.trainer.lastName}`);
      const loadTypes = warmup.videoTags.map(vt => vt.tag.loadType).filter(Boolean);
      console.log(`      LoadTypes: ${loadTypes.join(', ')}`);
    } else {
      console.log('   ⚠️  РАЗМИНКА не найдена');
    }

    // 2. ОСНОВНАЯ ЧАСТЬ (для слабой характеристики)
    const mainLoadTypeMapping: any = {
      POWER: ['POWER', 'MAX_STRENGTH'],
      SPEED: ['SPEED', 'AGILITY'],
      ENDURANCE: ['AEROBIC_ENDURANCE', 'ANAEROBIC_ENDURANCE', 'STRENGTH_ENDURANCE'],
      TECHNIQUE: ['TECHNICAL_SKILL', 'AGILITY'],
      FLEXIBILITY: ['MOBILITY', 'STATIC_STRETCH', 'DYNAMIC_STRETCH'],
    };

    const mainLoadTypes = mainLoadTypeMapping[weakest[0]] || ['POWER'];

    const mainWorkout = await prisma.video.findFirst({
      where: {
        isPublished: true,
        duration: { 
          gte: 300, // min 5 минут (снизил для теста)
          lte: 1800 // max 30 минут
        },
        videoTags: {
          some: {
            tag: {
              tagType: 'LOAD',
              loadType: { in: mainLoadTypes }
            }
          }
        }
      },
      include: {
        trainer: true,
        videoTags: {
          include: { tag: true }
        }
      }
    });

    console.log('\n   ✅ ОСНОВНАЯ ЧАСТЬ:');
    console.log(`      Цель: Развить ${weakest[0]} (${weakest[1].toFixed(1)})`);
    console.log(`      Ищем LoadTypes: ${mainLoadTypes.join(', ')}`);
    
    if (mainWorkout) {
      console.log(`      Найдено: "${mainWorkout.title}"`);
      console.log(`      Длительность: ${Math.floor(mainWorkout.duration / 60)} мин`);
      console.log(`      Тренер: ${mainWorkout.trainer.name} ${mainWorkout.trainer.lastName}`);
      const loadTypes = mainWorkout.videoTags.map(vt => vt.tag.loadType).filter(Boolean);
      console.log(`      LoadTypes: ${loadTypes.join(', ')}`);
    } else {
      console.log(`      ⚠️  Видео не найдено для LoadTypes: ${mainLoadTypes.join(', ')}`);
    }

    // 3. ЗАМИНКА
    const cooldown = await prisma.video.findFirst({
      where: {
        isPublished: true,
        duration: { lte: 600 },
        videoTags: {
          some: {
            tag: {
              tagType: 'LOAD',
              loadType: { in: ['STATIC_STRETCH', 'MOBILITY'] as any[] }
            }
          }
        }
      },
      include: {
        trainer: true,
        videoTags: {
          include: { tag: true }
        }
      }
    });

    console.log('\n   ✅ ЗАМИНКА:');
    if (cooldown) {
      console.log(`      "${cooldown.title}"`);
      console.log(`      Длительность: ${Math.floor(cooldown.duration / 60)} мин`);
      console.log(`      Тренер: ${cooldown.trainer.name} ${cooldown.trainer.lastName}`);
      const loadTypes = cooldown.videoTags.map(vt => vt.tag.loadType).filter(Boolean);
      console.log(`      LoadTypes: ${loadTypes.join(', ')}`);
    } else {
      console.log(`      ⚠️  ЗАМИНКА не найдена`);
    }

    console.log('\n' + '='.repeat(70));
    
    const modulesFound = [warmup, mainWorkout, cooldown].filter(Boolean).length;
    console.log(`\n📊 Итого: ${modulesFound}/3 модулей найдено`);

    if (modulesFound === 3) {
      console.log('✅ Полная тренировка может быть сформирована!');
    } else {
      console.log('⚠️  Не хватает видео для полной тренировки');
      console.log('💡 Рекомендация: Добавьте больше видео с LoadType тегами в админке');
    }

    console.log('\n✨ Тест завершён!');

  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewAlgorithm();
