const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

// Генерирует случайный код формата XXX-XXX
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без похожих символов (I, O, 0, 1)
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    if (i === 3) {
      code += '-';
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

// Проверяет, существует ли код в БД
async function isCodeUnique(code) {
  const existing = await prisma.inviteCode.findUnique({
    where: { code },
  });
  return !existing;
}

// Генерирует уникальный код
async function generateUniqueCode() {
  let code;
  let attempts = 0;
  const maxAttempts = 100;
  
  do {
    code = generateCode();
    attempts++;
    
    if (attempts >= maxAttempts) {
      throw new Error('Не удалось сгенерировать уникальный код после ' + maxAttempts + ' попыток');
    }
  } while (!(await isCodeUnique(code)));
  
  return code;
}

// Основная функция
async function generateInviteCodes() {
  const count = process.argv[2] ? parseInt(process.argv[2]) : 25;
  const description = process.argv[3] || 'Закрытое бета-тестирование';
  
  console.log(`\n🔐 Генерация ${count} инвайт-кодов...\n`);
  
  const codes = [];
  
  try {
    for (let i = 0; i < count; i++) {
      const code = await generateUniqueCode();
      
      const inviteCode = await prisma.inviteCode.create({
        data: {
          code,
          maxUses: 1, // Каждый код можно использовать 1 раз
          description,
          isActive: true,
        },
      });
      
      codes.push(inviteCode.code);
      console.log(`✅ ${i + 1}. ${inviteCode.code}`);
    }
    
    console.log(`\n✨ Успешно создано ${codes.length} инвайт-кодов!\n`);
    console.log('📋 Список кодов для распространения:');
    console.log('================================');
    codes.forEach((code, i) => {
      console.log(`${i + 1}. ${code}`);
    });
    console.log('================================\n');
    
    // Сохраняем коды в файл
    const fs = require('fs');
    const path = require('path');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `invite-codes-${timestamp}.txt`;
    const filepath = path.join(__dirname, filename);
    
    let fileContent = `TRENKI - Инвайт-коды для закрытого бета-тестирования\n`;
    fileContent += `Сгенерировано: ${new Date().toLocaleString('ru-RU')}\n`;
    fileContent += `Описание: ${description}\n`;
    fileContent += `Количество: ${codes.length}\n\n`;
    fileContent += `================================\n\n`;
    
    codes.forEach((code, i) => {
      fileContent += `${i + 1}. ${code}\n`;
    });
    
    fs.writeFileSync(filepath, fileContent);
    console.log(`💾 Коды сохранены в файл: ${filename}\n`);
    
  } catch (error) {
    console.error('❌ Ошибка при генерации кодов:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Запускаем генерацию
generateInviteCodes();
