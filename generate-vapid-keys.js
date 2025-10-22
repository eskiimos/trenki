const webpush = require('web-push');

// Генерируем VAPID ключи
const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID KEYS ===\n');
console.log('Добавь эти ключи в .env.local файл:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:your-email@example.com`);
console.log('\n==================\n');
