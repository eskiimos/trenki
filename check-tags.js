const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function checkTags() {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        tagType: 'LOAD'
      },
      orderBy: {
        order: 'asc'
      }
    });

    console.log('\n=== ТЕГИ ТИПА LOAD ===\n');
    tags.forEach(tag => {
      console.log(`ID: ${tag.id}`);
      console.log(`Name (key): ${tag.name}`);
      console.log(`DisplayName: ${tag.displayName}`);
      console.log(`Type: ${tag.tagType}`);
      console.log('---');
    });
    
    console.log(`\nВсего найдено: ${tags.length} тегов\n`);
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTags();
