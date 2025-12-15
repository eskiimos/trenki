 #!/bin/bash

# Скрипт развертывания с помощью Docker на сервере
# Запускайте этот скрипт на вашем сервере

set -e

echo "🚀 Начинаем развертывание Trenki через Docker..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Устанавливаем Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker установлен"
fi

# Проверка наличия Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose не установлен"
    exit 1
fi

# Проверка наличия .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте .env файл на основе .env.example"
    exit 1
fi

echo "📦 Останавливаем старые контейнеры..."
docker compose down

echo "🏗️  Собираем новые образы..."
docker compose build --no-cache

echo "🚀 Запускаем контейнеры..."
docker compose up -d

echo "⏳ Ожидаем запуска сервисов..."
sleep 10

echo "📊 Проверяем статус контейнеров..."
docker compose ps

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "Проверьте логи:"
echo "  docker compose logs -f web"
echo "  docker compose logs -f bot"
echo ""
echo "Приложение доступно на порту 3000"
