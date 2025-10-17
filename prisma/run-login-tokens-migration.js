const { PrismaClient } = require('../src/generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Применяем миграцию login_tokens...');
    
    // Выполняем каждую команду отдельно
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS login_tokens (
        token TEXT PRIMARY KEY,
        telegram_id TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Таблица login_tokens создана');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_login_tokens_telegram_id ON login_tokens(telegram_id)
    `);
    console.log('✅ Индекс idx_login_tokens_telegram_id создан');
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_login_tokens_expires_at ON login_tokens(expires_at)
    `);
    console.log('✅ Индекс idx_login_tokens_expires_at создан');
    
    console.log('🎉 Миграция login_tokens выполнена успешно!');
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
