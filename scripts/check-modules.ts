import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function checkModules() {
  try {
    console.log('📊 Проверка модулей в базе данных...\n');

    // Подсчет модулей по типам
    const warmupCount = await prisma.video.count({
      where: { moduleType: 'WARMUP', isPublished: true },
    });

    const fitnessCount = await prisma.video.count({
      where: { moduleType: 'FITNESS', isPublished: true },
    });

    const techniqueCount = await prisma.video.count({
      where: { moduleType: 'TECHNIQUE', isPublished: true },
    });

    const cooldownCount = await prisma.video.count({
      where: { moduleType: 'COOLDOWN', isPublished: true },
    });

    console.log('Количество модулей по типам:');
    console.log(`🔥 РАЗМИНКА (WARMUP): ${warmupCount}`);
    console.log(`💪 ФИЗ ПОДГОТОВКА (FITNESS): ${fitnessCount}`);
    console.log(`🏒 ТЕХНИКА (TECHNIQUE): ${techniqueCount}`);
    console.log(`🧘 ЗАМИНКА (COOLDOWN): ${cooldownCount}`);
    console.log(`\n📈 ВСЕГО: ${warmupCount + fitnessCount + techniqueCount + cooldownCount}\n`);

    // Проверяем разминки детальнее
    console.log('🔍 Детали РАЗМИНОК:');
    const warmups = await prisma.video.findMany({
      where: { moduleType: 'WARMUP', isPublished: true },
      select: {
        id: true,
        title: true,
        loadType: true,
        muscleGroup: true,
        complexity: true,
        rpeMin: true,
        rpeMax: true,
        ageGroups: true,
      },
    });

    warmups.forEach((w) => {
      console.log(`- ${w.title}`);
      console.log(`  LoadType: ${w.loadType || 'НЕТ'}`);
      console.log(`  MuscleGroup: ${w.muscleGroup || 'НЕТ'}`);
      console.log(`  Complexity: ${w.complexity}`);
      console.log(`  RPE: ${w.rpeMin}-${w.rpeMax}`);
      console.log(`  AgeGroups: ${w.ageGroups?.join(', ') || 'НЕТ'}`);
      console.log('');
    });

    console.log('\n🔍 Детали ЗАМИНОК:');
    const cooldowns = await prisma.video.findMany({
      where: { moduleType: 'COOLDOWN', isPublished: true },
      select: {
        id: true,
        title: true,
        loadType: true,
        muscleGroup: true,
        complexity: true,
        rpeMin: true,
        rpeMax: true,
        ageGroups: true,
      },
    });

    cooldowns.forEach((c) => {
      console.log(`- ${c.title}`);
      console.log(`  LoadType: ${c.loadType || 'НЕТ'}`);
      console.log(`  MuscleGroup: ${c.muscleGroup || 'НЕТ'}`);
      console.log(`  Complexity: ${c.complexity}`);
      console.log(`  RPE: ${c.rpeMin}-${c.rpeMax}`);
      console.log(`  AgeGroups: ${c.ageGroups?.join(', ') || 'НЕТ'}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkModules();
