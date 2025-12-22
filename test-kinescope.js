// Тестовый скрипт для проверки Kinescope API
// Запуск: node test-kinescope.js

// ⚠️ ВАЖНО: Используйте переменные окружения!
const KINESCOPE_API_KEY = process.env.KINESCOPE_API_KEY || 'YOUR_KINESCOPE_API_KEY';
// В URL вида https://kinescope.io/mFrWREAhz2iy2557cG9Fa1/plAE11wa
// первый ID после kinescope.io - это ID видео (UUID)
const VIDEO_ID = 'mFrWREAhz2iy2557cG9Fa1'; // Правильный UUID видео

async function testKinescopeAPI() {
  console.log('🧪 Тестирование Kinescope API...\n');
  console.log('API Key:', KINESCOPE_API_KEY);
  console.log('Video ID:', VIDEO_ID);
  console.log('\n---\n');

  try {
    const url = `https://api.kinescope.io/v1/videos/${VIDEO_ID}`;
    console.log('Запрос к:', url);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${KINESCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Статус ответа:', response.status, response.statusText);
    console.log('\n---\n');

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Успешно! Данные видео:');
      console.log(JSON.stringify(data, null, 2));
      
      console.log('\n---\n');
      console.log('📊 Извлечённые данные:');
      console.log('Название:', data.data?.title || 'не указано');
      console.log('Длительность:', data.data?.duration || 0, 'секунд');
      console.log('Превью:', data.data?.poster?.url || 'не указано');
      console.log('Описание:', data.data?.description || 'не указано');
    } else {
      const errorText = await response.text();
      console.error('❌ Ошибка API:');
      console.error(errorText);
    }
  } catch (error) {
    console.error('❌ Ошибка запроса:', error.message);
  }
}

testKinescopeAPI();
