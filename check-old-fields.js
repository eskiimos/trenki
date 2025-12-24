const { PrismaClient } = require('./src/generated/prisma');

const prisma = new PrismaClient();

async function checkOldFields() {
  try {
    const videos = await prisma.video.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        // Старые String поля
        moduleTypeOld: true,
        loadTypeOld: true,
        muscleGroupOld: true,
        complexityOld: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n📊 Проверка старых полей в ${videos.length} видео:\n`);

    // Собираем уникальные значения
    const uniqueModuleTypes = new Set();
    const uniqueLoadTypes = new Set();
    const uniqueMuscleGroups = new Set();
    const uniqueComplexity = new Set();

    videos.forEach((video) => {
      if (video.moduleTypeOld) uniqueModuleTypes.add(video.moduleTypeOld);
      if (video.loadTypeOld) uniqueLoadTypes.add(video.loadTypeOld);
      if (video.muscleGroupOld) uniqueMuscleGroups.add(video.muscleGroupOld);
      if (video.complexityOld) uniqueComplexity.add(video.complexityOld);
    });

    console.log('📝 УНИКАЛЬНЫЕ ЗНАЧЕНИЯ В СТАРЫХ ПОЛЯХ:\n');
    
    console.log('moduleTypeOld (типМодуля):');
    uniqueModuleTypes.forEach(val => console.log(`  - "${val}"`));
    console.log();

    console.log('loadTypeOld (типНагрузки):');
    if (uniqueLoadTypes.size === 0) {
      console.log('  ❌ НЕТ ДАННЫХ');
    } else {
      uniqueLoadTypes.forEach(val => console.log(`  - "${val}"`));
    }
    console.log();

    console.log('muscleGroupOld (группаМышц):');
    if (uniqueMuscleGroups.size === 0) {
      console.log('  ❌ НЕТ ДАННЫХ');
    } else {
      uniqueMuscleGroups.forEach(val => console.log(`  - "${val}"`));
    }
    console.log();

    console.log('complexityOld (сложность):');
    if (uniqueComplexity.size === 0) {
      console.log('  ❌ НЕТ ДАННЫХ');
    } else {
      uniqueComplexity.forEach(val => console.log(`  - "${val}"`));
    }
    console.log();

    // Выводим примеры видео
    console.log('📋 ПРИМЕРЫ ВИДЕО С ДАННЫМИ:\n');
    videos.slice(0, 5).forEach((video, i) => {
      console.log(`${i + 1}. ${video.title}`);
      console.log(`   moduleTypeOld: "${video.moduleTypeOld || 'NULL'}"`);
      console.log(`   loadTypeOld: "${video.loadTypeOld || 'NULL'}"`);
      console.log(`   muscleGroupOld: "${video.muscleGroupOld || 'NULL'}"`);
      console.log(`   complexityOld: "${video.complexityOld || 'NULL'}"`);
      console.log();
    });

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOldFields();
