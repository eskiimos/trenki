const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const videos = await prisma.video.findMany({
    select: {
      title: true,
      типМодуля: true,
      типНагрузки: true,
      rpeМин: true,
      rpeМакс: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 4
  });
  
  console.log('\n📹 Твои последние 4 видео:\n');
  videos.forEach((v, i) => {
    console.log(`${i+1}. ${v.title}`);
    console.log(`   Модуль: ${v.типМодуля || '❌ не указан'}`);
    console.log(`   Нагрузка: ${v.типНагрузки || '❌ не указана'}`);
    console.log(`   RPE: ${v.rpeМин || '?'} - ${v.rpeМакс || '?'}\n`);
  });
  
  const hasAllFields = videos.every(v => 
    v.типМодуля && v.типНагрузки && v.rpeМін !== null && v.rpeМакс !== null
  );
  
  if (hasAllFields) {
    console.log('✅ Все видео готовы для алгоритма!');
    console.log('❌ НО: Алгоритм пока работает со старой таблицей TrainingModule');
    console.log('📝 Нужно переписать /api/training/generate для работы с Video');
  } else {
    console.log('⚠️ Некоторые поля не заполнены');
  }
  
  await prisma.$disconnect();
}

main();
