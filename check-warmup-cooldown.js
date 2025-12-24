const { PrismaClient, ModuleType } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkWarmupCooldown() {
  console.log('🔍 ПРОВЕРКА РАЗМИНОК И ЗАМИНОК\n');
  
  // Разминки
  const warmups = await prisma.video.findMany({
    where: { moduleType: ModuleType.WARMUP },
    select: {
      title: true,
      loadType: true,
      muscleGroup: true,
    },
  });
  
  console.log('🤸 РАЗМИНКИ (WARMUP):');
  warmups.forEach(v => {
    console.log(`   ${v.title}`);
    console.log(`      loadType: ${v.loadType || 'не указан'}`);
    console.log(`      muscleGroup: ${v.muscleGroup || 'не указана'}`);
  });
  
  // Заминки
  const cooldowns = await prisma.video.findMany({
    where: { moduleType: ModuleType.COOLDOWN },
    select: {
      title: true,
      loadType: true,
      muscleGroup: true,
    },
  });
  
  console.log('\n🧘 ЗАМИНКИ (COOLDOWN):');
  cooldowns.forEach(v => {
    console.log(`   ${v.title}`);
    console.log(`      loadType: ${v.loadType || 'не указан'}`);
    console.log(`      muscleGroup: ${v.muscleGroup || 'не указана'}`);
  });
  
  await prisma.$disconnect();
}

checkWarmupCooldown();
