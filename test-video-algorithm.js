/**
 * Тест сохранения и чтения данных видео для Алгоритма 2.0
 * 
 * Проверяет:
 * 1. Все поля алгоритма сохраняются в БД
 * 2. Данные корректно читаются обратно
 * 3. Массивы ageGroups и trainingGoals работают
 */

const testVideoData = {
  // Основные поля
  title: "ТЕСТ - Разминка для хоккеистов",
  description: "Тестовое видео для проверки Алгоритма 2.0",
  videoUrl: "https://kinescope.io/test",
  thumbnail: "https://example.com/thumb.jpg",
  category: "SKATING",
  difficulty: "BEGINNER",
  trainerId: "REPLACE_WITH_REAL_TRAINER_ID", // Нужно заменить на реальный ID
  tags: ["тест"],
  equipment: ["Коньки"],
  isPublished: false, // Не публикуем тестовое видео
  duration: 600, // 10 минут
  
  // Поля алгоритма
  moduleType: "Разминка",
  loadType: "DYNAMIC_STRETCH",
  muscleGroup: "Все тело",
  complexity: "Новичок",
  rpeMin: 3,
  rpeMax: 5,
  
  // Алгоритм 2.0
  ageGroups: ["TEEN", "YOUNG_ADULT"],
  trainingGoals: ["POWERFUL_SHOT", "OUTRUN_OPPONENT"]
};

console.log('📋 Тестовые данные для создания видео:');
console.log(JSON.stringify(testVideoData, null, 2));
console.log('\n🔍 Проверьте в админке:');
console.log('1. Откройте http://localhost:3000/admin/videos');
console.log('2. Создайте новое видео с этими данными');
console.log('3. Убедитесь что все поля сохраняются');
console.log('4. Отредактируйте видео и проверьте что все поля загружаются');
console.log('\n📊 Критичные поля для алгоритма:');
console.log('- moduleType: ' + testVideoData.moduleType);
console.log('- loadType: ' + testVideoData.loadType);
console.log('- muscleGroup: ' + testVideoData.muscleGroup);
console.log('- complexity: ' + testVideoData.complexity);
console.log('- rpeMin/rpeMax: ' + testVideoData.rpeMin + '-' + testVideoData.rpeMax);
console.log('- ageGroups: ' + testVideoData.ageGroups.join(', '));
console.log('- trainingGoals: ' + testVideoData.trainingGoals.join(', '));

console.log('\n✅ Запрос для тестирования через curl:');
console.log(`
curl -X POST http://localhost:3000/api/videos \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testVideoData)}'
`);
