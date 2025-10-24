const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkZamingVideos() {
  console.log('🔍 Проверка видео для Заминки...\n');
  
  const videos = await prisma.video.findMany({
    where: {
      типМодуля: 'Заминка'
    },
    select: {
      id: true,
      title: true,
      isPublished: true,
      rpeМин: true,
      rpeМакс: true,
      videoUrl: true,
      trainer: {
        select: {
          name: true
        }
      }
    }
  });
  
  console.log(`Найдено видео с типом "Заминка": ${videos.length}\n`);
  
  if (videos.length === 0) {
    console.log('❌ Видео с типом модуля "Заминка" НЕ НАЙДЕНО!');
    console.log('\n📋 Что нужно учесть при создании видео для Заминки:');
    console.log('1️⃣  типМодуля = "Заминка" (точное написание!)');
    console.log('2️⃣  isPublished = true');
    console.log('3️⃣  rpeМакс <= 5 (легкая интенсивность)');
    console.log('4️⃣  videoUrl должен быть заполнен (Kinescope ID)');
    console.log('5️⃣  типНагрузки (например: "Восстановление", "Растяжка")');
    console.log('6️⃣  trainerId (тренер)');
    console.log('7️⃣  title (название)');
  } else {
    console.log(`✅ Найдено ${videos.length} видео:\n`);
    videos.forEach((v, i) => {
      console.log(`${i+1}. "${v.title}"`);
      console.log(`   isPublished: ${v.isPublished ? '✅' : '❌'}`);
      console.log(`   rpeМакс: ${v.rpeМакс} ${v.rpeМакс <= 5 ? '✅' : '❌ (должно быть <= 5)'}`);
      console.log(`   videoUrl: ${v.videoUrl ? '✅' : '❌'}`);
      console.log(`   Тренер: ${v.trainer?.name || '❌ не указан'}`);
      console.log('');
    });
  }
  
  // Проверим все типы модулей
  console.log('\n📊 Все типы модулей в базе:');
  const allVideos = await prisma.video.findMany({
    select: {
      типМодуля: true
    },
    distinct: ['типМодуля']
  });
  
  allVideos.forEach(v => {
    console.log(`   - "${v.типМодуля}"`);
  });
  
  await prisma.$disconnect();
}

checkZamingVideos().catch(console.error);
