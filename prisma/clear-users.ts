import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Удаляем всех пользователей из базы данных...');

  // Сначала удаляем все профили (из-за foreign key)
  const deletedProfiles = await prisma.profile.deleteMany({});
  console.log(`Удалено профилей: ${deletedProfiles.count}`);

  // Затем удаляем всех пользователей
  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`Удалено пользователей: ${deletedUsers.count}`);

  console.log('✅ Все пользователи успешно удалены!');
  console.log('Теперь можешь пройти полный путь регистрации.');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
