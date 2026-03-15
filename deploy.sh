#!/bin/bash

# Скрипт для быстрого развертывания Trenki на reg.ru VPS
# Использование: ./deploy.sh

set -e

echo "================================"
echo "🚀 Развертывание Trenki на reg.ru"
echo "================================"

# Проверить if root
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Скрипт должен запускаться от root"
   exit 1
fi

# 1. Обновить систему
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# 2. Установить Docker
echo "🐳 Установка Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo "✅ Docker установлен"
else
    echo "✅ Docker уже установлен"
fi

# 3. Установить Docker Compose
echo "🐳 Установка Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose установлен"
else
    echo "✅ Docker Compose уже установлен"
fi

# 4. Клонировать репозиторий
echo "📥 Загрузка репозитория..."
if [ ! -d "/home/trenki" ]; then
    git clone https://github.com/eskiimos/trenki.git /home/trenki
    echo "✅ Репозиторий загружен"
else
    echo "✅ Репозиторий уже существует"
fi

cd /home/trenki

# 5. Создать директорию для сертификатов
mkdir -p certs

# 6. Создать самоподписанный сертификат (для тестирования)
if [ ! -f "certs/cert.pem" ]; then
    echo "🔐 Создание самоподписанного сертификата..."
    openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem \
        -days 365 -nodes -subj "/CN=trenki.local" 2>/dev/null
    echo "✅ Сертификат создан"
fi

# 7. Проверить .env файл
if [ ! -f ".env.production" ]; then
    echo "⚠️  Файл .env.production не найден!"
    echo "📝 Создаю из .env.production.example..."
    cp .env.production.example .env.production
    echo "⚠️  ВАЖНО: Отредактируй .env.production с реальными переменными!"
    echo "   nano .env.production"
    echo "   Или: vim .env.production"
fi

# 8. Построить и запустить контейнеры
echo "🔨 Построение Docker образе..."
docker-compose -f docker-compose.production.yml build

echo "🚀 Запуск контейнеров..."
docker-compose -f docker-compose.production.yml up -d

# 9. Проверить статус
sleep 5
echo ""
echo "================================"
echo "✅ Развертывание завершено!"
echo "================================"
echo ""
echo "📊 Статус контейнеров:"
docker-compose -f docker-compose.production.yml ps
echo ""
echo "📋 Логи:"
docker-compose -f docker-compose.production.yml logs --tail=20 app
echo ""
echo "🌐 Приложение доступно по адресу:"
echo "   https://89.108.113.230"
echo ""
echo "📝 Полезные команды:"
echo "   docker-compose -f docker-compose.production.yml logs -f app   # Просмотр логов"
echo "   docker-compose -f docker-compose.production.yml restart app  # Перезагрузка приложе­ния"
echo "   docker-compose -f docker-compose.production.yml down         # Остановка"
echo ""
