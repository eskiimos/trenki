import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function checkTags() {
  const tags = await prisma.tag.findMany({ 
    where: { tagType: 'LOAD' },
    include: {
      _count: {
        select: { videos: true }
      }
    }
  });
  
  console.log('\n📊 LoadType теги в БД:\n');
  tags.forEach(t => {
    console.log(`   name: "${t.name}"`);
    console.log(`   displayName: "${t.displayName}"`);
    console.log(`   loadType: ${t.loadType}`);
    console.log(`   видео: ${t._count.videos}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkTags();
