import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function testEndToEnd() {
  try {
    console.log('🧪 ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ ХАРАКТЕРИСТИК\n');
    console.log('=' .repeat(60));
    
    // 1. Проверяем таблицу CharacteristicHistory
    console.log('\n1️⃣  Проверка таблицы CharacteristicHistory...');
    const historyCount = await prisma.characteristicHistory.count();
    console.log(`   ✅ Таблица существует, записей: ${historyCount}`);
    
    // 2. Проверяем пользователя с характеристиками
    console.log('\n2️⃣  Поиск пользователя с характеристиками...');
    const userWithCharacteristics = await prisma.profile.findFirst({
      where: {
        potential: { gt: 0 }
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
          }
        }
      }
    });
    
    if (!userWithCharacteristics) {
      console.log('   ⚠️  Пользователь с характеристиками не найден');
      console.log('   💡 Подсказка: Пройдите стартовый опрос в приложении');
      return;
    }
    
    console.log(`   ✅ Найден пользователь: ${userWithCharacteristics.user.telegramId}`);
    console.log(`   📊 Потенциал: ${userWithCharacteristics.potential}`);
    console.log(`   💪 Сила: ${userWithCharacteristics.ratingPower}`);
    console.log(`   ⚡ Скорость: ${userWithCharacteristics.ratingSpeed}`);
    console.log(`   🫀 Выносливость: ${userWithCharacteristics.ratingEndurance}`);
    console.log(`   🎯 Техника: ${userWithCharacteristics.ratingTechnique}`);
    console.log(`   🤸 Гибкость: ${userWithCharacteristics.ratingFlexibility}`);
    
    // 3. Проверяем начальные значения
    console.log('\n3️⃣  Проверка начальных данных опроса...');
    if (userWithCharacteristics.kMastery) {
      console.log(`   ✅ k_mastery: ${userWithCharacteristics.kMastery}`);
      console.log(`   📝 Самооценка силы: ${userWithCharacteristics.rawPower}/10`);
      console.log(`   📝 Самооценка скорости: ${userWithCharacteristics.rawSpeed}/10`);
      console.log(`   📝 Самооценка выносливости: ${userWithCharacteristics.rawEndurance}/10`);
      console.log(`   📝 Самооценка техники: ${userWithCharacteristics.rawTechnique}/10`);
      console.log(`   📝 Самооценка гибкости: ${userWithCharacteristics.rawFlexibility}/10`);
      
      // Рассчитываем начальные рейтинги
      const initialRatings = {
        power: Math.max(20, Math.min(75, (userWithCharacteristics.rawPower || 0) * userWithCharacteristics.kMastery)),
        speed: Math.max(20, Math.min(75, (userWithCharacteristics.rawSpeed || 0) * userWithCharacteristics.kMastery)),
        endurance: Math.max(20, Math.min(75, (userWithCharacteristics.rawEndurance || 0) * userWithCharacteristics.kMastery)),
        technique: Math.max(20, Math.min(75, (userWithCharacteristics.rawTechnique || 0) * userWithCharacteristics.kMastery)),
        flexibility: Math.max(20, Math.min(75, (userWithCharacteristics.rawFlexibility || 0) * userWithCharacteristics.kMastery)),
      };
      
      console.log('\n   📈 РАСЧЁТ ПРИРОСТА:');
      console.log(`   💪 Сила: ${initialRatings.power.toFixed(1)} → ${userWithCharacteristics.ratingPower} (${(userWithCharacteristics.ratingPower - initialRatings.power).toFixed(1)})`);
      console.log(`   ⚡ Скорость: ${initialRatings.speed.toFixed(1)} → ${userWithCharacteristics.ratingSpeed} (${(userWithCharacteristics.ratingSpeed - initialRatings.speed).toFixed(1)})`);
      console.log(`   🫀 Выносливость: ${initialRatings.endurance.toFixed(1)} → ${userWithCharacteristics.ratingEndurance} (${(userWithCharacteristics.ratingEndurance - initialRatings.endurance).toFixed(1)})`);
      console.log(`   🎯 Техника: ${initialRatings.technique.toFixed(1)} → ${userWithCharacteristics.ratingTechnique} (${(userWithCharacteristics.ratingTechnique - initialRatings.technique).toFixed(1)})`);
      console.log(`   🤸 Гибкость: ${initialRatings.flexibility.toFixed(1)} → ${userWithCharacteristics.ratingFlexibility} (${(userWithCharacteristics.ratingFlexibility - initialRatings.flexibility).toFixed(1)})`);
    } else {
      console.log('   ⚠️  Начальные данные опроса не найдены');
    }
    
    // 4. Проверяем историю тренировок
    console.log('\n4️⃣  Проверка истории тренировок...');
    const workoutCount = await prisma.workoutSession.count({
      where: { userId: userWithCharacteristics.userId }
    });
    console.log(`   ✅ Завершённых тренировок: ${workoutCount}`);
    
    // 5. Проверяем историю характеристик
    console.log('\n5️⃣  Проверка истории характеристик...');
    const characteristicHistory = await prisma.characteristicHistory.findMany({
      where: { userId: userWithCharacteristics.userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    if (characteristicHistory.length > 0) {
      console.log(`   ✅ Найдено записей: ${characteristicHistory.length}`);
      console.log('\n   📜 Последние записи:');
      characteristicHistory.forEach((record, i) => {
        console.log(`\n   ${i + 1}. ${record.eventType} - ${record.createdAt.toLocaleString('ru-RU')}`);
        console.log(`      Потенциал: ${record.potential}`);
        console.log(`      Приросты: 💪${record.gainPower} ⚡${record.gainSpeed} 🫀${record.gainEndurance} 🎯${record.gainTechnique} 🤸${record.gainFlexibility}`);
      });
    } else {
      console.log('   ⚠️  История пока пустая');
      console.log('   💡 Подсказка: Завершите тренировку или модуль, чтобы начать запись истории');
    }
    
    // 6. Итоговый статус
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 ИТОГОВЫЙ СТАТУС СИСТЕМЫ:\n');
    
    const checks = [
      { name: 'База данных', status: true },
      { name: 'Таблица CharacteristicHistory', status: true },
      { name: 'Пользователь с характеристиками', status: !!userWithCharacteristics },
      { name: 'Начальные данные опроса', status: !!userWithCharacteristics?.kMastery },
      { name: 'История тренировок', status: workoutCount > 0 },
      { name: 'История характеристик', status: characteristicHistory.length > 0 },
    ];
    
    checks.forEach(check => {
      const icon = check.status ? '✅' : '⚠️';
      const status = check.status ? 'OK' : 'НЕТ ДАННЫХ';
      console.log(`${icon} ${check.name}: ${status}`);
    });
    
    const allGreen = checks.every(c => c.status);
    console.log('\n' + '='.repeat(60));
    
    if (allGreen) {
      console.log('\n🎉 ВСЯ СИСТЕМА РАБОТАЕТ ИДЕАЛЬНО!');
      console.log('✨ Все компоненты подключены и функционируют.');
    } else {
      console.log('\n⚠️  СИСТЕМА ЧАСТИЧНО РАБОТАЕТ');
      console.log('💡 Некоторые данные отсутствуют - это нормально для новых пользователей.');
      console.log('📱 Используйте приложение для заполнения данных.');
    }
    
  } catch (error) {
    console.error('\n❌ ОШИБКА:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEndToEnd();
