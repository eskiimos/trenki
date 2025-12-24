const { PrismaClient, TrainingGoal } = require('./src/generated/prisma');

const prisma = new PrismaClient();

// Импортируем функции из алгоритма
async function testWorkoutGeneration() {
  try {
    console.log('🧪 ТЕСТИРУЕМ АЛГОРИТМ ГЕНЕРАЦИИ ТРЕНИРОВКИ\n');

    // Создаем тестовую оценку состояния
    const testUserId = 'test_workout_generation_user';
    
    // Создаем тестового пользователя если нет
    let user = await prisma.user.findUnique({
      where: { telegramId: testUserId }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: testUserId,
          firstName: 'Test',
          lastName: 'User',
        }
      });
      console.log('✅ Создан тестовый пользователь');
    }

    // Создаем тестовую оценку
    const assessment = await prisma.userStateAssessment.create({
      data: {
        userId: user.id,
        lastTrainingTime: 'YESTERDAY', // Коэфф. свежести = 2
        energyLevel: 7, // Уровень энергии = 7
        // Итого: readinessLevel = 2 + 7 = 9 → DEVELOPMENT
        muscleReadiness: 7,
        motivation: 8,
        availableTime: 60,
        loadDirection: 'MEDIUM',
        recommendedRPE: 6,
      }
    });

    console.log('✅ Создана тестовая оценка состояния:');
    console.log(`   lastTrainingTime: YESTERDAY (коэфф. 2)`);
    console.log(`   energyLevel: 7`);
    console.log(`   readinessLevel: 2 + 7 = 9 → Статус: DEVELOPMENT`);
    console.log(`   recommendedRPE: 6\n`);

    // Проверяем доступные видео для каждого типа модуля
    console.log('📊 ПРОВЕРКА ДОСТУПНЫХ ВИДЕО:\n');

    const warmupCount = await prisma.video.count({
      where: {
        isPublished: true,
        moduleType: 'WARMUP',
        trainingGoals: { has: TrainingGoal.DEVELOPMENT }
      }
    });

    const fitnessCount = await prisma.video.count({
      where: {
        isPublished: true,
        moduleType: 'FITNESS',
        loadType: { in: ['ANAEROBIC_ENDURANCE', 'AEROBIC_ENDURANCE', 'AGILITY', 'SPEED'] },
        trainingGoals: { has: TrainingGoal.DEVELOPMENT }
      }
    });

    const techniqueCount = await prisma.video.count({
      where: {
        isPublished: true,
        moduleType: 'TECHNIQUE',
      }
    });

    const cooldownCount = await prisma.video.count({
      where: {
        isPublished: true,
        moduleType: 'COOLDOWN',
      }
    });

    console.log(`   WARMUP (разминка): ${warmupCount} видео`);
    console.log(`   FITNESS (ОФП): ${fitnessCount} видео для DEVELOPMENT`);
    console.log(`   TECHNIQUE (техника): ${techniqueCount} видео`);
    console.log(`   COOLDOWN (заминка): ${cooldownCount} видео\n`);

    if (fitnessCount === 0) {
      console.log('❌ НЕ ХВАТАЕТ видео FITNESS для статуса DEVELOPMENT!');
      console.log('   Нужны видео с loadType: AEROBIC_ENDURANCE, ANAEROBIC_ENDURANCE, AGILITY, SPEED');
      console.log('   И trainingGoals должен включать DEVELOPMENT\n');
    }

    if (cooldownCount === 0) {
      console.log('⚠️ НЕТ видео COOLDOWN! Создайте хотя бы одно видео-заминку\n');
    }

    // Теперь пытаемся сгенерировать тренировку через API
    console.log('🔄 Вызываем API генерации тренировки...\n');

    const response = await fetch('http://localhost:3000/api/training/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testUserId,
        assessmentId: assessment.id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.log('❌ ОШИБКА ГЕНЕРАЦИИ:');
      console.log(`   Статус: ${response.status}`);
      console.log(`   Сообщение: ${result.message || result.error}`);
      
      if (result.missingModules) {
        console.log(`   Отсутствующие модули: ${result.missingModules.join(', ')}`);
      }
      console.log();
      return;
    }

    console.log('✅ ТРЕНИРОВКА УСПЕШНО СГЕНЕРИРОВАНА!\n');
    console.log('📋 ДЕТАЛИ ТРЕНИРОВКИ:');
    console.log(`   ID: ${result.workout.id}`);
    console.log(`   Статус тренировки: ${result.workout.trainingStatus || 'не указан'}`);
    console.log(`   Целевая длительность: ${result.workout.targetDuration} мин`);
    console.log(`   Фактическая длительность: ${result.workout.actualDuration} мин`);
    console.log(`   Целевой RPE: ${result.workout.targetRPE}`);
    console.log(`   Количество модулей: ${result.workout.modulesCount}/4\n`);

    console.log('🎬 МОДУЛИ В ТРЕНИРОВКЕ:\n');
    result.workout.modules.forEach((module, index) => {
      console.log(`${index + 1}. ${module.title}`);
      console.log(`   Тип модуля: ${module.moduleType || 'не указан'}`);
      console.log(`   Тип нагрузки: ${module.loadType || 'не указан'}`);
      console.log(`   Направление: ${module.muscleGroup || 'не указано'}`);
      console.log(`   Длительность: ${Math.round(module.duration / 60)} мин`);
      console.log();
    });

    if (result.workout.modulesCount === 4) {
      console.log('🎉 ИДЕАЛЬНО! Все 4 модуля подобраны согласно алгоритму «Треньки»!');
    } else {
      console.log(`⚠️ Подобрано ${result.workout.modulesCount}/4 модулей. Добавьте больше видео.`);
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error.message);
    if (error.cause) {
      console.error('Причина:', error.cause);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testWorkoutGeneration();
