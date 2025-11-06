import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

async function checkHistoryTable() {
  try {
    console.log('🔍 Проверка таблицы CharacteristicHistory...\n');
    
    // Проверяем, существует ли таблица
    const count = await prisma.characteristicHistory.count();
    console.log(`✅ Таблица CharacteristicHistory существует!`);
    console.log(`📊 Записей в таблице: ${count}\n`);
    
    // Пробуем создать тестовую запись
    console.log('🧪 Попытка создания тестовой записи...');
    
    // Находим первого пользователя с характеристиками
    const testUser = await prisma.profile.findFirst({
      where: {
        potential: {
          gt: 0
        }
      },
      select: {
        userId: true,
        ratingPower: true,
        ratingSpeed: true,
        ratingEndurance: true,
        ratingTechnique: true,
        ratingFlexibility: true,
        potential: true,
      }
    });
    
    if (testUser) {
      console.log(`👤 Найден пользователь ID: ${testUser.userId}`);
      
      const testRecord = await prisma.characteristicHistory.create({
        data: {
          userId: testUser.userId,
          ratingPower: testUser.ratingPower || 0,
          ratingSpeed: testUser.ratingSpeed || 0,
          ratingEndurance: testUser.ratingEndurance || 0,
          ratingTechnique: testUser.ratingTechnique || 0,
          ratingFlexibility: testUser.ratingFlexibility || 0,
          potential: testUser.potential || 0,
          gainPower: 2.5,
          gainSpeed: 1.8,
          gainEndurance: 3.2,
          gainTechnique: 1.5,
          gainFlexibility: 2.1,
          eventType: 'TEST',
        }
      });
      
      console.log('✅ Тестовая запись успешно создана!');
      console.log(`🆔 ID записи: ${testRecord.id}`);
      console.log(`📅 Дата создания: ${testRecord.createdAt}`);
      
      // Читаем запись обратно
      const readRecord = await prisma.characteristicHistory.findUnique({
        where: { id: testRecord.id },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
            }
          }
        }
      });
      
      console.log('\n📖 Прочитанная запись:');
      console.log(`   Пользователь: ${readRecord?.user.telegramId}`);
      console.log(`   Потенциал: ${readRecord?.potential}`);
      console.log(`   Прирост силы: +${readRecord?.gainPower}`);
      console.log(`   Тип события: ${readRecord?.eventType}`);
      
      // Удаляем тестовую запись
      await prisma.characteristicHistory.delete({
        where: { id: testRecord.id }
      });
      console.log('\n🗑️  Тестовая запись удалена');
      
    } else {
      console.log('⚠️  Не найдено пользователей с характеристиками для теста');
    }
    
    console.log('\n✅ Проверка завершена успешно! БД полностью функциональна.');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHistoryTable();
