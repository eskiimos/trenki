import { prisma } from '@/lib/prisma';

async function checkVideoFields() {
  try {
    console.log('📺 Проверка полей видео...\n');

    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        moduleType: true,
        loadType: true,
        muscleGroup: true,
        difficulty: true,
        rpeMin: true,
        rpeMax: true,
      },
      take: 10,
    });

    console.log(`✅ Проверено видео: ${videos.length}\n`);

    videos.forEach((v, i) => {
      console.log(
        `${i + 1}. "${v.title.substring(0, 40)}..." - moduleType: ${v.moduleType}, loadType: ${v.loadType}, muscleGroup: ${v.muscleGroup}, difficulty: ${v.difficulty}, RPE: ${v.rpeMin}-${v.rpeMax}`
      );
    });

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVideoFields();
