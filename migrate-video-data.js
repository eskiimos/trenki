const { PrismaClient, ModuleType, LoadType, MuscleGroup, Complexity, TrainingGoal } = require('./src/generated/prisma');

const prisma = new PrismaClient();

// Маппинг русских значений в enum
const MODULE_TYPE_MAP = {
  'Разминка': ModuleType.WARMUP,
  'ОФП': ModuleType.FITNESS,
  'Техника': ModuleType.TECHNIQUE,
  'Заминка': ModuleType.COOLDOWN,
};

const MUSCLE_GROUP_MAP = {
  'Все тело': MuscleGroup.FULL_BODY,
  'Низ тела': MuscleGroup.LOWER_BODY,
  'Верх жим': MuscleGroup.UPPER_PUSH,
  'Верх тяга': MuscleGroup.UPPER_PULL,
  'Кор стабилизация': MuscleGroup.CORE_STABILITY,
  'Кор динамика': MuscleGroup.CORE_DYNAMICS,
  'ЛФК плечо': MuscleGroup.PREHAB_SHOULDER,
  'ЛФК колено': MuscleGroup.PREHAB_KNEE,
  'ЛФК спина': MuscleGroup.PREHAB_BACK,
};

const COMPLEXITY_MAP = {
  'Начинающий': Complexity.BEGINNER,
  'Любитель': Complexity.AMATEUR,
  'Продвинутый': Complexity.ADVANCED,
  'Профи': Complexity.PRO,
};

// Маппинг для извлечения loadType из названия
const LOAD_TYPE_KEYWORDS = {
  'Ловкость': LoadType.AGILITY,
  'Скорость': LoadType.SPEED,
  'Мощность': LoadType.POWER,
  'Сила': LoadType.MAX_STRENGTH,
  'Выносливость': LoadType.AEROBIC_ENDURANCE, // по умолчанию аэробная
  'ЛФК': LoadType.PREHAB,
  'Мобильность': LoadType.MOBILITY,
  'Растяжка': LoadType.STATIC_STRETCH,
  'Динамическая растяжка': LoadType.DYNAMIC_STRETCH,
  'Кроссфит': LoadType.AGILITY, // кроссфит = комплексная ловкость
  'Техника': LoadType.TECHNICAL_SKILL,
};

// Автоматическое назначение trainingGoals на основе loadType
function getTrainingGoalsByLoadType(loadType) {
  const recoveryTypes = [LoadType.PREHAB, LoadType.MOBILITY, LoadType.STATIC_STRETCH, LoadType.DYNAMIC_STRETCH];
  const developmentTypes = [LoadType.AEROBIC_ENDURANCE, LoadType.AGILITY, LoadType.STRENGTH_ENDURANCE];
  const peakTypes = [LoadType.POWER, LoadType.MAX_STRENGTH, LoadType.SPEED, LoadType.ANAEROBIC_ENDURANCE];
  
  if (recoveryTypes.includes(loadType)) {
    return [TrainingGoal.RECOVERY];
  } else if (peakTypes.includes(loadType)) {
    return [TrainingGoal.DEVELOPMENT, TrainingGoal.PEAK];
  } else if (developmentTypes.includes(loadType)) {
    return [TrainingGoal.DEVELOPMENT, TrainingGoal.PEAK];
  } else if (loadType === LoadType.TECHNICAL_SKILL) {
    return [TrainingGoal.RECOVERY, TrainingGoal.DEVELOPMENT, TrainingGoal.PEAK]; // техника подходит всем
  }
  
  return [TrainingGoal.DEVELOPMENT]; // по умолчанию
}

// Извлечение loadType из названия видео
function extractLoadTypeFromTitle(title, moduleType) {
  const titleLower = title.toLowerCase();
  
  // Специальная логика для разминки и заминки
  if (moduleType === ModuleType.WARMUP) {
    if (titleLower.includes('кроссфит')) return LoadType.AGILITY;
    return LoadType.DYNAMIC_STRETCH;
  }
  
  if (moduleType === ModuleType.COOLDOWN) {
    return LoadType.STATIC_STRETCH;
  }
  
  // Ищем ключевые слова в названии
  for (const [keyword, loadType] of Object.entries(LOAD_TYPE_KEYWORDS)) {
    if (titleLower.includes(keyword.toLowerCase())) {
      return loadType;
    }
  }
  
  // По умолчанию для техники
  if (moduleType === ModuleType.TECHNIQUE) {
    return LoadType.TECHNICAL_SKILL;
  }
  
  // По умолчанию для ОФП - выносливость
  if (moduleType === ModuleType.FITNESS) {
    return LoadType.AEROBIC_ENDURANCE;
  }
  
  return null;
}

async function migrateVideoData() {
  try {
    console.log('🚀 Начинаем миграцию данных видео...\n');
    
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        moduleTypeOld: true,
        muscleGroupOld: true,
        complexityOld: true,
        moduleType: true,
        loadType: true,
        muscleGroup: true,
        complexity: true,
        trainingGoals: true,
      },
    });

    console.log(`📊 Найдено ${videos.length} видео для миграции\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const video of videos) {
      try {
        // Проверяем, нужно ли обновлять
        if (video.moduleType && video.loadType && video.muscleGroup && video.trainingGoals?.length > 0) {
          console.log(`⏭️  Пропускаем "${video.title}" - уже заполнено`);
          skipCount++;
          continue;
        }

        // Конвертируем moduleType
        const moduleType = video.moduleTypeOld ? MODULE_TYPE_MAP[video.moduleTypeOld] : null;
        
        // Конвертируем muscleGroup
        const muscleGroup = video.muscleGroupOld ? MUSCLE_GROUP_MAP[video.muscleGroupOld] : null;
        
        // Конвертируем complexity
        const complexity = video.complexityOld ? COMPLEXITY_MAP[video.complexityOld] : null;
        
        // Извлекаем loadType из названия
        const loadType = extractLoadTypeFromTitle(video.title, moduleType);
        
        // Автоматически назначаем trainingGoals
        const trainingGoals = loadType ? getTrainingGoalsByLoadType(loadType) : [];

        // Обновляем видео
        await prisma.video.update({
          where: { id: video.id },
          data: {
            moduleType: moduleType || video.moduleType,
            muscleGroup: muscleGroup || video.muscleGroup,
            complexity: complexity || video.complexity,
            loadType: loadType || video.loadType,
            trainingGoals: trainingGoals.length > 0 ? trainingGoals : video.trainingGoals,
          },
        });

        console.log(`✅ Обновлено: "${video.title}"`);
        console.log(`   moduleType: ${moduleType || 'не определено'}`);
        console.log(`   loadType: ${loadType || 'не определено'}`);
        console.log(`   muscleGroup: ${muscleGroup || 'не определено'}`);
        console.log(`   complexity: ${complexity || 'не определено'}`);
        console.log(`   trainingGoals: ${trainingGoals.join(', ') || 'не определено'}`);
        console.log();
        
        successCount++;
      } catch (error) {
        console.error(`❌ Ошибка при обновлении "${video.title}":`, error.message);
        errorCount++;
      }
    }

    console.log('\n📈 ИТОГИ МИГРАЦИИ:');
    console.log(`   ✅ Успешно обновлено: ${successCount}`);
    console.log(`   ⏭️  Пропущено (уже заполнено): ${skipCount}`);
    console.log(`   ❌ Ошибок: ${errorCount}`);
    console.log(`   📊 Всего обработано: ${videos.length}`);

    if (successCount > 0) {
      console.log('\n🎉 Миграция завершена! Проверяем результат...\n');
      
      // Проверка результата
      const updatedVideos = await prisma.video.findMany({
        where: { isPublished: true },
        select: {
          moduleType: true,
          loadType: true,
          muscleGroup: true,
          trainingGoals: true,
        },
      });

      const fullyConfigured = updatedVideos.filter(v => 
        v.moduleType && v.loadType && v.muscleGroup && v.trainingGoals?.length > 0
      ).length;

      console.log(`✅ Готовых видео для алгоритма: ${fullyConfigured}/${updatedVideos.length}`);
      
      if (fullyConfigured === updatedVideos.length) {
        console.log('🎊 ВСЕ ВИДЕО ГОТОВЫ для нового алгоритма «Треньки»!');
      } else {
        console.log(`⚠️  Осталось настроить: ${updatedVideos.length - fullyConfigured} видео`);
      }
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateVideoData();
