const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkVideoData() {
  try {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        category: true,
        difficulty: true,
        rpeМин: true,
        rpeМакс: true,
        // Новые поля
        moduleType: true,
        loadType: true,
        muscleGroup: true,
        trainingGoals: true,
        ageGroup: true,
        // Старые поля
        moduleTypeOld: true,
        loadTypeOld: true,
        muscleGroupOld: true,
        complexityOld: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    console.log(`\n📊 Найдено опубликованных видео: ${videos.length}\n`);

    videos.forEach((video, index) => {
      console.log(`${index + 1}. ${video.title}`);
      console.log(`   Category: ${video.category}`);
      console.log(`   Difficulty: ${video.difficulty}`);
      console.log(`   RPE: ${video.rpeМин}-${video.rpeМакс}`);
      console.log(`   🆕 moduleType: ${video.moduleType || '❌ НЕ ЗАПОЛНЕНО'}`);
      console.log(`   🆕 loadType: ${video.loadType || '❌ НЕ ЗАПОЛНЕНО'}`);
      console.log(`   🆕 muscleGroup: ${video.muscleGroup || '❌ НЕ ЗАПОЛНЕНО'}`);
      console.log(`   🆕 trainingGoals: ${video.trainingGoals?.length ? video.trainingGoals.join(', ') : '❌ НЕ ЗАПОЛНЕНО'}`);
      console.log(`   🆕 ageGroup: ${video.ageGroup || 'не указано'}`);
      console.log(`   📝 Старые: moduleTypeOld="${video.moduleTypeOld}", loadTypeOld="${video.loadTypeOld}"`);
      console.log('');
    });

    // Статистика
    const stats = {
      withModuleType: videos.filter(v => v.moduleType).length,
      withLoadType: videos.filter(v => v.loadType).length,
      withMuscleGroup: videos.filter(v => v.muscleGroup).length,
      withTrainingGoals: videos.filter(v => v.trainingGoals?.length > 0).length,
      fullyConfigured: videos.filter(v => 
        v.moduleType && v.loadType && v.muscleGroup && v.trainingGoals?.length > 0
      ).length,
    };

    console.log('📈 СТАТИСТИКА:');
    console.log(`   Всего видео: ${videos.length}`);
    console.log(`   С moduleType: ${stats.withModuleType}/${videos.length}`);
    console.log(`   С loadType: ${stats.withLoadType}/${videos.length}`);
    console.log(`   С muscleGroup: ${stats.withMuscleGroup}/${videos.length}`);
    console.log(`   С trainingGoals: ${stats.withTrainingGoals}/${videos.length}`);
    console.log(`   Полностью готовы: ${stats.fullyConfigured}/${videos.length}`);
    
    if (stats.fullyConfigured === 0) {
      console.log('\n⚠️ НИ ОДНО ВИДЕО НЕ ГОТОВО для нового алгоритма!');
      console.log('Нужно заполнить: moduleType, loadType, muscleGroup, trainingGoals');
    } else if (stats.fullyConfigured < videos.length) {
      console.log(`\n⚠️ Только ${stats.fullyConfigured} из ${videos.length} видео готовы для нового алгоритма`);
    } else {
      console.log('\n✅ ВСЕ ВИДЕО ГОТОВЫ для нового алгоритма!');
    }

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVideoData();
