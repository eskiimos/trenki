// Скрипт для проверки логики needsOnboarding
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testOnboardingLogic(telegramId) {
  try {
    console.log('🔍 Проверяем пользователя с telegramId:', telegramId);
    
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
      include: { profile: true }
    });
    
    console.log('\n📊 Пользователь:', {
      id: user?.id,
      telegramId: user?.telegramId,
      firstName: user?.firstName,
      email: user?.email,
    });
    
    console.log('\n📊 Профиль:', {
      exists: !!user?.profile,
      age: user?.profile?.age,
      gender: user?.profile?.gender,
      name: user?.profile?.name,
    });
    
    const needsOnboarding = !user || !user.profile || !user.profile.age || !user.profile.gender;
    
    console.log('\n✅ Результат:');
    console.log('needsOnboarding =', needsOnboarding);
    console.log('\nЛогика:');
    console.log('  !user =', !user);
    console.log('  !user.profile =', !user?.profile);
    console.log('  !user.profile.age =', !user?.profile?.age);
    console.log('  !user.profile.gender =', !user?.profile?.gender);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем telegramId из аргументов командной строки
const telegramId = process.argv[2];

if (!telegramId) {
  console.log('Использование: node test-onboarding-logic.js <telegramId>');
  process.exit(1);
}

testOnboardingLogic(telegramId);
