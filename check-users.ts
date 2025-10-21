import prisma from './src/lib/prisma';

async function checkUsers() {
  try {
    console.log('🔍 Проверяем пользователей в базе данных...\n');
    
    const users = await prisma.user.findMany({
      include: {
        profile: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log(`📊 Найдено пользователей: ${users.length}\n`);

    users.forEach((user, index) => {
      console.log(`--- Пользователь #${index + 1} ---`);
      console.log(`ID: ${user.id}`);
      console.log(`Telegram ID: ${user.telegramId}`);
      console.log(`Имя: ${user.firstName || 'НЕ УКАЗАНО'}`);
      console.log(`Фамилия: ${user.lastName || 'НЕ УКАЗАНО'}`);
      console.log(`Username: ${user.username || 'нет'}`);
      console.log(`Email: ${user.email || 'нет'}`);
      console.log(`Email подтвержден: ${user.emailVerified}`);
      console.log(`Создан: ${user.createdAt}`);
      console.log(`Обновлен: ${user.updatedAt}`);
      
      if (user.profile) {
        console.log(`\n📝 Профиль:`);
        console.log(`  Возраст: ${user.profile.age || 'не указан'}`);
        console.log(`  Пол: ${user.profile.gender || 'не указан'}`);
      } else {
        console.log(`\n❌ Профиль не создан`);
      }
      console.log('\n');
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
