import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function checkVideos() {
  try {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      include: {
        videoTags: {
          include: { tag: true }
        }
      }
    });

    console.log(`\n📹 Всего опубликованных видео: ${videos.length}\n`);

    for (const video of videos) {
      const loadTypes = video.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD')
        .map(vt => vt.tag.loadType);

      console.log('━'.repeat(60));
      console.log(`📹 ${video.title}`);
      console.log(`   ID: ${video.id}`);
      console.log(`   Длительность: ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`);
      console.log(`   Сложность: ${video.difficulty}`);
      console.log(`   LoadTypes: ${loadTypes.join(', ') || '❌ НЕТ'}`);
      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('\n🔍 Проверка условий для генерации:\n');

    // WARMUP: MOBILITY или DYNAMIC_STRETCH, длительность <= 600 сек
    const warmupVideos = videos.filter(v => {
      const loadTypes = v.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD')
        .map(vt => vt.tag.loadType);
      return v.duration <= 600 && (loadTypes.includes('MOBILITY') || loadTypes.includes('DYNAMIC_STRETCH'));
    });
    console.log(`✅ WARMUP видео (≤10 мин, MOBILITY/DYNAMIC_STRETCH): ${warmupVideos.length}`);
    warmupVideos.forEach(v => console.log(`   - ${v.title} (${v.difficulty})`));

    // COOLDOWN: STATIC_STRETCH или MOBILITY, длительность <= 600 сек
    const cooldownVideos = videos.filter(v => {
      const loadTypes = v.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD')
        .map(vt => vt.tag.loadType);
      return v.duration <= 600 && (loadTypes.includes('STATIC_STRETCH') || loadTypes.includes('MOBILITY'));
    });
    console.log(`\n✅ COOLDOWN видео (≤10 мин, STATIC_STRETCH/MOBILITY): ${cooldownVideos.length}`);
    cooldownVideos.forEach(v => console.log(`   - ${v.title} (${v.difficulty})`));

    // MAIN: любые LoadType кроме STATIC_STRETCH/PREHAB, длительность >= 300 сек
    const mainVideos = videos.filter(v => {
      const loadTypes = v.videoTags
        .filter(vt => vt.tag.tagType === 'LOAD')
        .map(vt => vt.tag.loadType);
      return v.duration >= 300 && !loadTypes.includes('STATIC_STRETCH') && !loadTypes.includes('PREHAB');
    });
    console.log(`\n✅ MAIN видео (≥5 мин, не STATIC_STRETCH/PREHAB): ${mainVideos.length}`);
    mainVideos.forEach(v => console.log(`   - ${v.title} (${v.difficulty}, ${Math.floor(v.duration / 60)} мин)`));

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVideos();
