import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function testVideoLoadType() {
  try {
    console.log('🧪 ТЕСТ: Проверка LoadType тегов у видео\n');
    console.log('='.repeat(60));
    
    // Находим первое видео
    const video = await prisma.video.findFirst({
      include: {
        videoTags: {
          include: {
            tag: true
          }
        }
      }
    });
    
    if (!video) {
      console.log('⚠️  Видео не найдено');
      return;
    }
    
    console.log(`\n📹 Видео: ${video.title}`);
    console.log(`   ID: ${video.id}`);
    console.log(`   URL: ${video.videoUrl}`);
    
    // Проверяем LoadType теги
    const loadTypeTags = video.videoTags.filter(vt => vt.tag.tagType === 'LOAD');
    
    console.log(`\n🏷️  LoadType теги (${loadTypeTags.length}):`);
    
    if (loadTypeTags.length === 0) {
      console.log('   ⚠️  LoadType тегов нет');
      console.log('\n💡 Рекомендация:');
      console.log('   1. Зайдите в админку: /admin/videos');
      console.log('   2. Отредактируйте видео');
      console.log('   3. Выберите "Тип физической нагрузки"');
      console.log('   4. Сохраните изменения');
      console.log('   5. LoadType тег будет создан автоматически!');
    } else {
      loadTypeTags.forEach((vt, i) => {
        console.log(`   ${i + 1}. ${vt.tag.name}`);
        console.log(`      displayName: ${vt.tag.displayName}`);
        console.log(`      loadType: ${vt.tag.loadType}`);
      });
    }
    
    // Проверяем все LoadType теги в системе
    console.log('\n📊 Все LoadType теги в системе:');
    const allLoadTypeTags = await prisma.tag.findMany({
      where: { tagType: 'LOAD' },
      include: {
        _count: {
          select: { videos: true }
        }
      }
    });
    
    if (allLoadTypeTags.length === 0) {
      console.log('   ⚠️  LoadType тегов в системе нет');
    } else {
      console.log(`   Найдено: ${allLoadTypeTags.length} тегов\n`);
      allLoadTypeTags.forEach((tag, i) => {
        console.log(`   ${i + 1}. ${tag.name}`);
        console.log(`      Тип нагрузки: ${tag.loadType}`);
        console.log(`      Видео с этим тегом: ${tag._count.videos}`);
      });
    }
    
    // Проверяем маппинг
    console.log('\n🗺️  Маппинг типов нагрузки → LoadType:');
    const mapping = {
      'Сила': 'POWER',
      'Мощность': 'POWER',
      'Скорость': 'SPEED',
      'Силовая выносливость': 'ENDURANCE',
      'Анаэробная выносливость': 'ENDURANCE',
      'Аэробная выносливость': 'ENDURANCE',
      'Ловкость': 'TECHNIQUE',
      'Мобильность': 'FLEXIBILITY',
      'Техника': 'TECHNIQUE',
      'Статическая растяжка': 'FLEXIBILITY',
      'Динамическая растяжка': 'FLEXIBILITY',
    };
    
    Object.entries(mapping).forEach(([key, value]) => {
      console.log(`   "${key}" → LoadType:${value}`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Тест завершён!');
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testVideoLoadType();
