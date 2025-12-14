#!/bin/bash

# Скрипт развертывания с помощью systemd на сервере
# Запускайте этот скрипт на вашем сервере

set -e

echo "🚀 Начинаем развертывание Trenki через systemd..."

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Устанавливаем Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "✅ Node.js установлен"
fi

# Путь установки
INSTALL_PATH="/var/www/trenki"

echo "📁 Создаем директорию для приложения..."
sudo mkdir -p $INSTALL_PATH
sudo chown -R $USER:$USER $INSTALL_PATH

echo "📋 Копируем файлы..."
rsync -av --exclude='node_modules' --exclude='.next' --exclude='logs' --exclude='.git' ./ $INSTALL_PATH/

cd $INSTALL_PATH

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте .env файл на основе .env.example в $INSTALL_PATH"
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

echo "⚙️  Устанавливаем systemd сервисы..."
sudo cp systemd/trenki-web.service /etc/systemd/system/
sudo cp systemd/trenki-bot.service /etc/systemd/system/

echo "🔄 Перезагружаем systemd..."
sudo systemctl daemon-reload

echo "🚀 Запускаем сервисы..."
sudo systemctl enable trenki-web.service
sudo systemctl enable trenki-bot.service
sudo systemctl restart trenki-web.service
sudo systemctl restart trenki-bot.service

echo "⏳ Ожидаем запуска сервисов..."
sleep 5

echo "📊 Проверяем статус сервисов..."
sudo systemctl status trenki-web.service --no-pager
sudo systemctl status trenki-bot.service --no-pager

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "Команды systemd:"
echo "  sudo systemctl status trenki-web    - статус веб-сервера"
echo "  sudo systemctl status trenki-bot    - статус бота"
echo "  sudo systemctl restart trenki-web   - перезапуск веб-сервера"
echo "  sudo systemctl restart trenki-bot   - перезапуск бота"
echo "  sudo journalctl -u trenki-web -f    - логи веб-сервера"
echo "  sudo journalctl -u trenki-bot -f    - логи бота"
echo ""
echo "Приложение доступно на порту 3000"
