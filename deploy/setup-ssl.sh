#!/bin/bash
# Получение SSL сертификата для trenki.app

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

if [ "$EUID" -ne 0 ]; then 
    error "Запустите от root: sudo bash setup-ssl.sh"
fi

echo "🔒 Получение SSL сертификата для trenki.app..."
echo ""

# Проверяем DNS
echo "Проверяем DNS записи..."
DOMAIN_IP=$(dig +short trenki.app | tail -n1)
if [ -z "$DOMAIN_IP" ]; then
    error "Домен trenki.app не резолвится! Настройте DNS в панели reg.ru"
fi

echo "Домен trenki.app указывает на: $DOMAIN_IP"
SERVER_IP=$(curl -s ifconfig.me)
echo "IP сервера: $SERVER_IP"

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
    warning "IP домена ($DOMAIN_IP) не совпадает с IP сервера ($SERVER_IP)"
    read -p "Продолжить? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Запрашиваем email
read -p "Введите email для уведомлений Let's Encrypt: " EMAIL
if [ -z "$EMAIL" ]; then
    error "Email обязателен!"
fi

# Создаём директорию для certbot
mkdir -p /var/www/certbot

# Получаем сертификат
echo ""
echo "Получаем сертификат..."
certbot certonly --webroot -w /var/www/certbot \
  -d trenki.app -d www.trenki.app \
  --email "$EMAIL" --agree-tos --non-interactive

if [ $? -eq 0 ]; then
    success "Сертификат получен!"
else
    error "Не удалось получить сертификат. Проверьте DNS и firewall."
fi

# Раскомментируем SSL строки в конфиге
sed -i 's/^    #ssl_certificate/    ssl_certificate/g' /etc/nginx/sites-available/trenki.app
sed -i 's/^    #listen 443 ssl/    listen 443 ssl/g' /etc/nginx/sites-available/trenki.app

# Проверяем и перезапускаем Nginx
if nginx -t; then
    systemctl reload nginx
    success "Nginx перезапущен с SSL"
else
    error "Ошибка в конфигурации Nginx"
fi

echo ""
echo "═════════════════════════════════════════════════════"
echo "✅ SSL сертификат установлен!"
echo "═════════════════════════════════════════════════════"
echo ""
echo "Сайт доступен по адресу: https://trenki.app"
echo ""
echo "Сертификат будет автоматически обновляться."
echo "Проверка обновления: certbot renew --dry-run"
