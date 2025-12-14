#!/bin/bash

# 🚀 Скрипт загрузки проекта на сервер reg.ru
# Запускайте этот скрипт ЛОКАЛЬНО на вашем Mac

set -e

SERVER_IP="83.166.245.178"
SERVER_USER="root"
SERVER_PATH="/opt/trenki"
DOMAIN="trenki.app"

echo "🚀 Загрузка Trenki на сервер $DOMAIN ($SERVER_IP)..."
echo ""

# Проверка, что мы запускаем локально
if [ -d "/opt/trenki" ]; then
    echo "⚠️  Похоже, вы уже на сервере. Используйте ./deploy/deploy-on-server.sh"
    exit 1
fi

# Проверка наличия необходимых файлов
if [ ! -f "Dockerfile" ] || [ ! -f "docker-compose.yml" ]; then
    echo "❌ Не найдены файлы Docker. Убедитесь, что вы в корне проекта."
    exit 1
fi

echo "📋 Проверяю .env.production..."
if [ ! -f ".env.production" ]; then
    echo "❌ Файл .env.production не найден!"
    echo "Создайте его перед загрузкой на сервер"
    exit 1
fi

echo "✅ .env.production найден"
echo ""

# Подготовка архива (исключаем ненужное)
echo "📦 Создаю архив проекта..."
tar -czf /tmp/trenki-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.venv' \
    --exclude='old-project' \
    --exclude='.env' \
    --exclude='.env.local' \
    .

echo "✅ Архив создан: /tmp/trenki-deploy.tar.gz"
echo ""

echo "📤 Загружаю на сервер..."
echo "Подключаюсь к $SERVER_USER@$SERVER_IP"
echo ""

# Создаем директорию на сервере
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_PATH"

# Загружаем архив
scp /tmp/trenki-deploy.tar.gz $SERVER_USER@$SERVER_IP:$SERVER_PATH/

# Распаковываем на сервере
ssh $SERVER_USER@$SERVER_IP << EOF
    cd $SERVER_PATH
    echo "📦 Распаковываю архив..."
    tar -xzf trenki-deploy.tar.gz
    rm trenki-deploy.tar.gz
    
    echo "📋 Копирую .env.production в .env..."
    cp .env.production .env
    
    echo "✅ Файлы загружены в $SERVER_PATH"
    echo ""
    echo "Список файлов:"
    ls -lh
EOF

# Удаляем локальный архив
rm /tmp/trenki-deploy.tar.gz

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Проект загружен на сервер!"
echo ""
echo "Теперь подключитесь к серверу и запустите развертывание:"
echo ""
echo "  ssh $SERVER_USER@$SERVER_IP"
echo "  cd $SERVER_PATH"
echo "  ./deploy/deploy-on-server.sh"
echo ""
echo "Или выполните все сразу:"
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && ./deploy/deploy-on-server.sh'"
echo ""
