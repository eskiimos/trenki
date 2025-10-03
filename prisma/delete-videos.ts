import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Удаляем все видео из базы данных...');

  const result = await prisma.video.deleteMany({});

  console.log(`Удалено ${result.count} видео`);
}

main()
  .catch((e) => {
    console.error('Ошибка при удалении видео:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
