#!/bin/bash
# Автоматическое развёртывание Trenki на Ubuntu сервере
# Использование: bash auto-deploy.sh

set -e

echo "🚀 Начинаем автоматическое развёртывание Trenki..."
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода ошибок
error() {
    echo -e "${RED}❌ Ошибка: $1${NC}"
    exit 1
}

# Функция для успешных сообщений
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Функция для предупреждений
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Проверка, что скрипт запущен от root
if [ "$EUID" -ne 0 ]; then 
    error "Запустите скрипт от root: sudo bash auto-deploy.sh"
fi

echo "📦 Шаг 1/8: Обновление системы..."
apt update && apt -y upgrade
success "Система обновлена"

echo ""
echo "🔧 Шаг 2/8: Установка необходимых пакетов..."
apt -y install git curl ufw nginx certbot
success "Пакеты установлены"

echo ""
echo "🕐 Шаг 3/8: Настройка timezone..."
timedatectl set-timezone Europe/Moscow
success "Timezone установлен: Europe/Moscow"

echo ""
echo "🔥 Шаг 4/8: Настройка firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable
success "Firewall настроен"

echo ""
echo "💾 Шаг 5/8: Создание swap файла (2GB)..."
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
    success "Swap создан"
else
    warning "Swap файл уже существует"
fi

echo ""
echo "🐳 Шаг 6/8: Установка Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    success "Docker установлен: $(docker --version)"
else
    warning "Docker уже установлен: $(docker --version)"
fi

echo ""
echo "📥 Шаг 7/8: Клонирование репозитория..."
cd ~
if [ -d "trenki" ]; then
    warning "Директория trenki уже существует"
    read -p "Удалить и клонировать заново? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf trenki
        git clone https://github.com/eskiimos/trenki.git
        success "Репозиторий клонирован"
    else
        cd trenki
        git pull
        success "Репозиторий обновлён"
    fi
else
    git clone https://github.com/eskiimos/trenki.git
    success "Репозиторий клонирован"
fi

cd ~/trenki

echo ""
echo "⚙️  Шаг 8/8: Настройка .env файла..."
if [ ! -f .env ]; then
    cat > .env.template << 'EOF'
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Next.js
NEXT_PUBLIC_APP_URL=https://trenki.app
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
NODE_ENV=production

# Telegram Bot
BOT_TOKEN=your_telegram_bot_token

# Kinescope
KINESCOPE_API_KEY=your_kinescope_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# VAPID (опционально)
NEXT_PUBLIC_VAPID_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
EOF
    warning ".env файл не найден!"
    echo ""
    echo "Создан шаблон .env.template"
    echo "Отредактируйте файл .env и запустите:"
    echo ""
    echo "  nano ~/trenki/.env"
    echo "  cd ~/trenki"
    echo "  docker compose build"
    echo "  docker compose up -d"
    echo ""
    exit 0
else
    success ".env файл найден"
fi

echo ""
echo "🏗️  Сборка Docker образов..."
docker compose build --no-cache
success "Образы собраны"

echo ""
echo "🚀 Запуск контейнеров..."
docker compose up -d
success "Контейнеры запущены"

echo ""
echo "⏳ Ожидание запуска приложения (15 сек)..."
sleep 15

echo ""
echo "📊 Проверка статуса контейнеров..."
docker compose ps

echo ""
echo ""
echo "═════════════════════════════════════════════════════"
echo "✅ Базовая настройка завершена!"
echo "═════════════════════════════════════════════════════"
echo ""
echo "Приложение запущено на порту 3000"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Настройте Nginx:"
echo "   cd ~/trenki"
echo "   bash deploy/setup-nginx.sh"
echo ""
echo "2. Настройте DNS для домена trenki.app:"
echo "   A-запись: @ → 89.104.70.39"
echo "   A-запись: www → 89.104.70.39"
echo ""
echo "3. Получите SSL сертификат:"
echo "   bash deploy/setup-ssl.sh"
echo ""
echo "📖 Полная документация: deploy/DEPLOY_GUIDE.md"
echo ""
