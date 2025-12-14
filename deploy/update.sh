#!/bin/bash

# Скрипт обновления приложения на сервере
# Используйте этот скрипт для обновления уже развернутого приложения

set -e

echo "🔄 Обновление приложения Trenki..."

# Определяем метод развертывания
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
    echo "🐳 Обнаружен Docker, используем Docker..."
    
    git pull
    docker compose down
    docker compose build --no-cache
    docker compose up -d
    
    echo "✅ Обновление через Docker завершено!"
    
elif command -v pm2 &> /dev/null && [ -f ecosystem.config.js ]; then
    echo "📦 Обнаружен PM2, используем PM2..."
    
    git pull
    npm ci --only=production
    cd telegram-bot && npm ci --only=production && cd ..
    npx prisma generate
    npm run generate:icons
    npm run build
    pm2 restart all
    
    echo "✅ Обновление через PM2 завершено!"
    
elif [ -f /etc/systemd/system/trenki-web.service ]; then
    echo "⚙️  Обнаружен systemd, используем systemd..."
    
    INSTALL_PATH="/var/www/trenki"
    cd $INSTALL_PATH
    
    git pull
    npm ci --only=production
    cd telegram-bot && npm ci --only=production && cd ..
    npx prisma generate
    npm run generate:icons
    npm run build
    
    sudo systemctl restart trenki-web.service
    sudo systemctl restart trenki-bot.service
    
    echo "✅ Обновление через systemd завершено!"
    
else
    echo "❌ Не удалось определить метод развертывания"
    exit 1
fi

echo ""
echo "Проверьте логи для убедитесь, что приложение работает корректно"
