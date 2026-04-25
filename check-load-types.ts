import { prisma } from '@/lib/prisma';

async function checkLoadTypes() {
  try {
    console.log('📊 Проверка LOAD типов в видео...\n');

    const videos = await prisma.video.findMany({
      include: {
        videoTags: {
          include: {
            tag: true,
          },
        },
        trainer: {
          select: {
            name: true,
            lastName: true,
          },
        },
      },
      where: {
        isPublished: true,
      },
    });

    console.log(`✅ Всего опубликованных видео: ${videos.length}\n`);

    let videosWithLoadTypes = 0;
    let videosWithoutLoadTypes = 0;
    const videosWithoutLoad: any[] = [];

    videos.forEach((video) => {
      const loadTypes = video.videoTags
        .filter((vt) => vt.tag.tagType === 'LOAD' && vt.tag.loadType)
        .map((vt) => vt.tag.loadType);

      if (loadTypes.length > 0) {
        videosWithLoadTypes++;
      } else {
        videosWithoutLoadTypes++;
        videosWithoutLoad.push({
          id: video.id,
          title: video.title,
          trainer: `${video.trainer.name} ${video.trainer.lastName}`,
          moduleType: video.moduleType,
          loadType: video.loadType,
        });
      }
    });

    console.log(`✅ С LOAD тегами: ${videosWithLoadTypes}`);
    console.log(`❌ БЕЗ LOAD тегов: ${videosWithoutLoadTypes}\n`);

    if (videosWithoutLoad.length > 0) {
      console.log('📝 Видео БЕЗ LOAD тегов:');
      videosWithoutLoad.forEach((v, i) => {
        console.log(
          `${i + 1}. ${v.title} (${v.trainer}) - moduleType: ${v.moduleType}, loadType: ${v.loadType}`
        );
      });
    }

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLoadTypes();
