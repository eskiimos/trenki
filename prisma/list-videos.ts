import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function listVideos() {
  const videos = await prisma.video.findMany({
    include: {
      videoTags: {
        include: { tag: true }
      }
    }
  });

  console.log(`\n📹 Всего видео в базе: ${videos.length}\n`);
  console.log('='.repeat(70));

  videos.forEach(v => {
    const loadTypes = v.videoTags
      .filter(vt => vt.tag.tagType === 'LOAD')
      .map(vt => vt.tag.loadType);
    
    console.log(`\n📹 ${v.title}`);
    console.log(`   ID: ${v.id}`);
    console.log(`   Длительность: ${Math.floor(v.duration/60)}:${(v.duration % 60).toString().padStart(2, '0')}`);
    console.log(`   Опубликовано: ${v.isPublished ? '✅' : '❌'}`);
    console.log(`   LoadTypes: ${loadTypes.join(', ') || '⚠️  НЕТ'}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n💡 РЕКОМЕНДАЦИЯ:');
  console.log('   Для генерации тренировок нужны видео с LoadType:');
  console.log('   - POWER, MAX_STRENGTH (для силы)');
  console.log('   - SPEED (для скорости)');
  console.log('   - AEROBIC_ENDURANCE, ANAEROBIC_ENDURANCE (для выносливости)');
  console.log('   - AGILITY (для ловкости)');
  console.log('   - DYNAMIC_STRETCH (для динамической разминки)');

  await prisma.$disconnect();
}

listVideos();
