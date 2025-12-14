#!/bin/bash

# Скрипт развертывания с помощью PM2 на сервере
# Запускайте этот скрипт на вашем сервере

set -e

echo "🚀 Начинаем развертывание Trenki через PM2..."

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Устанавливаем Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✅ Node.js установлен"
fi

# Проверка наличия PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Устанавливаем PM2..."
    sudo npm install -g pm2
    echo "✅ PM2 установлен"
fi

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте .env файл на основе .env.example"
    exit 1
fi

echo "📦 Устанавливаем зависимости..."
npm ci --only=production

echo "📦 Устанавливаем зависимости для бота..."
cd telegram-bot
npm ci --only=production
cd ..

echo "🔧 Генерируем Prisma клиент..."
npx prisma generate

echo "🎨 Генерируем иконки..."
npm run generate:icons

echo "🏗️  Собираем Next.js приложение..."
npm run build

echo "🗂️  Создаем директорию для логов..."
mkdir -p logs

echo "🔄 Перезапускаем приложение через PM2..."
pm2 delete all || true
pm2 start ecosystem.config.js

echo "💾 Сохраняем конфигурацию PM2..."
pm2 save

echo "⚙️  Настраиваем автозапуск PM2..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "Команды PM2:"
echo "  pm2 status         - статус процессов"
echo "  pm2 logs           - просмотр логов"
echo "  pm2 restart all    - перезапуск"
echo "  pm2 stop all       - остановка"
echo ""
echo "Приложение доступно на порту 3000"
