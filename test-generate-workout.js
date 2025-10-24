// Тест генерации тренировки
async function testGenerate() {
  console.log('🧪 Тестируем генерацию тренировки...\n');

  // 1. Создаём оценку состояния
  console.log('📊 Шаг 1: Создаём оценку состояния');
  const assessmentResponse = await fetch('http://localhost:3000/api/training/assessment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: '1761040383',
      lastTrainingTime: 'YESTERDAY',
      energyLevel: 7,
      muscleReadiness: 8,
      motivation: 8,
      availableTime: 30,
    })
  });

  if (!assessmentResponse.ok) {
    console.error('❌ Ошибка при создании оценки');
    return;
  }

  const assessmentData = await assessmentResponse.json();
  console.log('✅ Оценка создана:', {
    id: assessmentData.assessment.id,
    recommendedRPE: assessmentData.assessment.recommendedRPE,
    loadDirection: assessmentData.assessment.loadDirection,
    trainingStatus: assessmentData.assessment.trainingStatus,
  });

  // 2. Генерируем тренировку
  console.log('\n🏋️ Шаг 2: Генерируем тренировку');
  const generateResponse = await fetch('http://localhost:3000/api/training/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: '1761040383',
      assessmentId: assessmentData.assessment.id,
    })
  });

  if (!generateResponse.ok) {
    const error = await generateResponse.text();
    console.error('❌ Ошибка при генерации:', error);
    return;
  }

  const workoutData = await generateResponse.json();
  console.log('✅ Тренировка сгенерирована!\n');
  console.log('📋 Детали тренировки:');
  console.log(`   ID: ${workoutData.workout.id}`);
  console.log(`   Целевое время: ${workoutData.workout.targetDuration} мин`);
  console.log(`   Фактическое время: ${workoutData.workout.actualDuration} мин`);
  console.log(`   Целевой RPE: ${workoutData.workout.targetRPE}`);
  console.log(`   Количество видео: ${workoutData.workout.modulesCount}\n`);

  console.log('🎬 Видео в тренировке:');
  workoutData.workout.modules.forEach((module, i) => {
    console.log(`\n${i + 1}. ${module.title}`);
    console.log(`   Тип: ${module.типМодуля}`);
    console.log(`   Нагрузка: ${module.типНагрузки}`);
    console.log(`   RPE: ${module.rpeRange}`);
    console.log(`   Длительность: ${Math.round(module.duration / 60)} мин`);
    console.log(`   Тренер: ${module.trainer.name} ${module.trainer.lastName}`);
  });

  console.log('\n🎉 Тест успешно пройден!');
}

testGenerate().catch(console.error);
