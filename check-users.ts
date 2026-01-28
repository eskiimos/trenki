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
        let ageDisplay = 'не указан';
        if (user.profile.birthDate) {
          const today = new Date();
          const birthDate = new Date(user.profile.birthDate);
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          ageDisplay = `${age} лет (ДР: ${birthDate.toISOString().split('T')[0]})`;
        }
        console.log(`  Возраст: ${ageDisplay}`);
        console.log(`  Возрастная группа: ${user.profile.ageGroup || 'не указана'}`);
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
