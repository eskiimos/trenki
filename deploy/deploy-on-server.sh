#!/bin/bash

# 🚀 Скрипт развертывания Trenki на сервере reg.ru
# IP: 83.166.245.178
# Домен: trenki.app

set -e

echo "🚀 Развертывание Trenki на trenki.app..."
echo ""

# Проверка, что мы на сервере
if [ "$(hostname)" = "localhost" ] || [ "$(hostname)" = "MacBook"* ]; then
    echo "⚠️  Этот скрипт нужно запускать на сервере, а не локально!"
    echo ""
    echo "Используйте вместо этого:"
    echo "  ./deploy/deploy-to-server.sh"
    exit 1
fi

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Docker не установлен. Устанавливаем Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker установлен"
    echo "⚠️  Нужно перелогиниться для применения прав Docker"
    echo "Выполните: logout и затем снова подключитесь"
    exit 0
fi

# Проверка Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не найден"
    echo "Установите Docker Compose v2"
    exit 1
fi

# Проверка .env файла
if [ ! -f .env ]; then
    if [ -f .env.production ]; then
        echo "📋 Копирую .env.production в .env"
        cp .env.production .env
    else
        echo "❌ Файл .env не найден!"
        echo "Создайте .env файл на основе .env.example"
        exit 1
    fi
fi

echo "📦 Останавливаю старые контейнеры..."
docker compose down || true

echo "🏗️  Собираю новые образы..."
docker compose build --no-cache

echo "🚀 Запускаю контейнеры..."
docker compose up -d

echo "⏳ Ожидаю запуска сервисов..."
sleep 10

echo "📊 Проверяю статус контейнеров..."
docker compose ps

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "Проверьте логи:"
echo "  docker compose logs -f web"
echo "  docker compose logs -f bot"
echo ""
echo "Приложение работает на порту 3000"
echo "Теперь настройте Nginx и SSL"
