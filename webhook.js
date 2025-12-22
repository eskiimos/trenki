#!/usr/bin/env node

// ⚠️ ВАЖНО: НЕ храните токен в коде!
// Используйте переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const WEBHOOK_URL = 'https://trenki.vercel.app/api/telegram';

async function setWebhook() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        drop_pending_updates: true
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook успешно установлен!');
      console.log(`🔗 URL: ${WEBHOOK_URL}`);
    } else {
      console.error('❌ Ошибка установки webhook:', result);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function getWebhookInfo() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const result = await response.json();
    
    console.log('📋 Информация о webhook:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Ошибка получения информации:', error);
  }
}

async function deleteWebhook() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST'
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook удален!');
    } else {
      console.error('❌ Ошибка удаления webhook:', result);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

// Обработка аргументов командной строки
const command = process.argv[2];

switch (command) {
  case 'set':
    setWebhook();
    break;
  case 'info':
    getWebhookInfo();
    break;
  case 'delete':
    deleteWebhook();
    break;
  default:
    console.log(`
📱 Управление Telegram webhook

Использование:
  node webhook.js set     - Установить webhook
  node webhook.js info    - Информация о webhook  
  node webhook.js delete  - Удалить webhook

Текущие настройки:
  BOT_TOKEN: ${BOT_TOKEN.slice(0, 10)}...
  WEBHOOK_URL: ${WEBHOOK_URL}
    `);
}
