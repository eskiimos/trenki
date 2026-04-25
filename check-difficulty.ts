import { prisma } from '@/lib/prisma';

async function checkDifficulty() {
  try {
    const video = await prisma.video.findFirst({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        difficulty: true,
        moduleType: true,
        loadType: true,
        muscleGroup: true,
      },
    });

    if (video) {
      console.log('\n📹 Video Difficulty Check:');
      console.log('ID:', video.id);
      console.log('Title:', video.title);
      console.log('difficulty (raw):', video.difficulty, 'type:', typeof video.difficulty);
      console.log('moduleType:', video.moduleType, 'type:', typeof video.moduleType);
      console.log('loadType:', video.loadType, 'type:', typeof video.loadType);
      console.log('muscleGroup:', video.muscleGroup, 'type:', typeof video.muscleGroup);
    } else {
      console.log('No videos found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDifficulty();
