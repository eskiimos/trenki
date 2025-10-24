// Тестовый скрипт для проверки API тренировочных модулей
// Запуск: node test-training-modules-api.js

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
  console.log('🧪 Тестирование API тренировочных модулей\n');

  try {
    // 1. Получаем список видео
    console.log('1️⃣ Получаем список видео...');
    const videosRes = await fetch(`${BASE_URL}/api/videos/all`);
    const videosData = await videosRes.json();
    console.log(`✅ Найдено видео: ${videosData.videos?.length || 0}`);
    
    const firstVideo = videosData.videos?.[0];
    if (firstVideo) {
      console.log(`   Первое видео: "${firstVideo.title}" (ID: ${firstVideo.id})\n`);
    } else {
      console.log('   ⚠️ Видео не найдено. Нужно сначала добавить видео в /admin/videos\n');
    }

    // 2. Создаем тестовый модуль
    console.log('2️⃣ Создаем тестовый тренировочный модуль...');
    const createRes = await fetch(`${BASE_URL}/api/training/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Тестовая разминка',
        description: 'Динамическая растяжка всего тела',
        type: 'WARMUP',
        videoId: firstVideo?.id || null,
        loadType: 'DYNAMIC_STRETCH',
        muscleGroup: 'FULL_BODY',
        complexity: 'BEGINNER',
        rpeMin: 3,
        rpeMax: 5,
        order: 0,
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      console.log(`✅ Модуль создан: "${createData.module.name}" (ID: ${createData.module.id})\n`);

      // 3. Получаем список модулей
      console.log('3️⃣ Получаем список всех модулей...');
      const modulesRes = await fetch(`${BASE_URL}/api/training/modules`);
      const modulesData = await modulesRes.json();
      console.log(`✅ Найдено модулей: ${modulesData.count}`);
      modulesData.modules.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m.name} (${m.type}) - RPE ${m.rpeMin}-${m.rpeMax}`);
      });
      console.log('');

      // 4. Получаем конкретный модуль
      const moduleId = createData.module.id;
      console.log(`4️⃣ Получаем модуль по ID: ${moduleId}...`);
      const getRes = await fetch(`${BASE_URL}/api/training/modules/${moduleId}`);
      const getData = await getRes.json();
      console.log(`✅ Модуль получен: "${getData.module.name}"`);
      console.log(`   Тип: ${getData.module.type}`);
      console.log(`   Нагрузка: ${getData.module.loadType}`);
      console.log(`   Мышцы: ${getData.module.muscleGroup}`);
      console.log(`   Сложность: ${getData.module.complexity}`);
      console.log(`   RPE: ${getData.module.rpeMin}-${getData.module.rpeMax}\n`);

      // 5. Обновляем модуль
      console.log('5️⃣ Обновляем модуль...');
      const updateRes = await fetch(`${BASE_URL}/api/training/modules/${moduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Тестовая разминка (обновлено)',
          description: 'Обновленное описание',
          type: 'WARMUP',
          videoId: firstVideo?.id || null,
          loadType: 'DYNAMIC_STRETCH',
          muscleGroup: 'FULL_BODY',
          complexity: 'AMATEUR',
          rpeMin: 4,
          rpeMax: 6,
          order: 0,
        }),
      });
      const updateData = await updateRes.json();
      console.log(`✅ Модуль обновлен: "${updateData.module.name}"`);
      console.log(`   Новая сложность: ${updateData.module.complexity}`);
      console.log(`   Новый RPE: ${updateData.module.rpeMin}-${updateData.module.rpeMax}\n`);

      // 6. Удаляем тестовый модуль
      console.log('6️⃣ Удаляем тестовый модуль...');
      const deleteRes = await fetch(`${BASE_URL}/api/training/modules/${moduleId}`, {
        method: 'DELETE',
      });
      if (deleteRes.ok) {
        console.log('✅ Модуль успешно удален\n');
      }

      console.log('🎉 Все тесты пройдены успешно!');
    } else {
      const error = await createRes.json();
      console.error('❌ Ошибка создания модуля:', error);
    }
  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
    console.log('\n⚠️ Убедитесь, что dev-сервер запущен на порту 3001');
  }
}

testAPI();
