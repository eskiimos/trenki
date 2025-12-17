#!/bin/bash
# Настройка Nginx для trenki.app

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

if [ "$EUID" -ne 0 ]; then 
    error "Запустите от root: sudo bash setup-nginx.sh"
fi

echo "🌐 Настройка Nginx для trenki.app..."

# Проверка наличия конфига
if [ ! -f deploy/nginx-trenki.app.conf ]; then
    error "Файл deploy/nginx-trenki.app.conf не найден!"
fi

# Копируем конфиг
cp deploy/nginx-trenki.app.conf /etc/nginx/sites-available/trenki.app

# Временно комментируем SSL (сертификата пока нет)
sed -i 's/^    ssl_certificate/    #ssl_certificate/g' /etc/nginx/sites-available/trenki.app
sed -i 's/^    listen 443 ssl/    #listen 443 ssl/g' /etc/nginx/sites-available/trenki.app

# Включаем сайт
ln -sf /etc/nginx/sites-available/trenki.app /etc/nginx/sites-enabled/

# Отключаем дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Создаём директорию для certbot
mkdir -p /var/www/certbot

# Проверяем конфигурацию
if nginx -t; then
    systemctl reload nginx
    success "Nginx настроен и перезапущен"
else
    error "Ошибка в конфигурации Nginx"
fi

echo ""
echo "Nginx слушает на портах 80 (HTTP)"
echo "Для включения HTTPS запустите: bash deploy/setup-ssl.sh"
