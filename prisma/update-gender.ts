import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Обновляем gender для существующих профилей...');

  // Обновляем все профили где gender = null
  const result = await prisma.profile.updateMany({
    where: {
      gender: null
    },
    data: {
      gender: 'MALE'
    }
  });

  console.log(`Обновлено ${result.count} профилей`);
}

main()
  .catch((e) => {
    console.error('Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
