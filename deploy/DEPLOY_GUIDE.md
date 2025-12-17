# Пошаговое развёртывание на сервере trenki.app

## Данные сервера
- **IP**: YOUR_SERVER_IP
- **Логин**: root (или другой пользователь)
- **Пароль**: Из панели хостинга
- **Домен**: ваш-домен.ru

---

## Шаг 1: Подключение к серверу

```bash
ssh root@YOUR_SERVER_IP
```

Введите пароль из панели хостинга

---

## Шаг 2: Базовая настройка (выполнить на сервере)

```bash
# Обновление системы
apt update && apt -y upgrade

# Установка необходимых пакетов
apt -y install git curl ufw nginx certbot

# Настройка timezone
timedatectl set-timezone Europe/Moscow

# Настройка firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable
ufw status

# Создание swap (2GB для стабильности)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
```

---

## Шаг 3: Установка Docker

```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Проверка версии
docker --version
docker compose version
```

---

## Шаг 4: Клонирование проекта и настройка .env

```bash
# Клонирование репозитория
cd ~
git clone https://github.com/eskiimos/trenki.git
cd trenki

# Создание .env файла
cat > .env << 'EOF'
# Database
DATABASE_URL="ваш_postgresql_url_от_vercel_или_neon"

# Next.js
NEXT_PUBLIC_APP_URL=https://ваш-домен.ru
NEXT_PUBLIC_BOT_USERNAME=ваш_бот_username
NODE_ENV=production

# Telegram Bot
BOT_TOKEN=ваш_telegram_bot_token

# Kinescope
KINESCOPE_API_KEY=ваш_kinescope_api_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=ваш_cloud_name
CLOUDINARY_API_KEY=ваш_api_key
CLOUDINARY_API_SECRET=ваш_api_secret

# VAPID для push-уведомлений (если используется)
NEXT_PUBLIC_VAPID_KEY=ваш_vapid_public_key
VAPID_PRIVATE_KEY=ваш_vapid_private_key
EOF

# Отредактируйте .env и вставьте реальные значения
nano .env
```

**ВАЖНО**: Скопируйте значения из вашего локального `.env` или из Vercel.

---

## Шаг 5: Запуск приложения через Docker

```bash
# Сборка и запуск контейнеров
docker compose build --no-cache
docker compose up -d

# Проверка статуса
docker compose ps
docker compose logs -f web
```

Нажмите `Ctrl+C` чтобы выйти из логов.

---

## Шаг 6: Настройка Nginx

```bash
# Копируем конфиг nginx
cp deploy/nginx-trenki.app.conf /etc/nginx/sites-available/trenki.app

# Временно комментируем SSL строки (сертификата пока нет)
sed -i 's/ssl_certificate/#ssl_certificate/g' /etc/nginx/sites-available/trenki.app
sed -i 's/ssl_certificate_key/#ssl_certificate_key/g' /etc/nginx/sites-available/trenki.app
sed -i 's/listen 443 ssl/#listen 443 ssl/g' /etc/nginx/sites-available/trenki.app

# Включаем сайт
ln -s /etc/nginx/sites-available/trenki.app /etc/nginx/sites-enabled/

# Отключаем дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
nginx -t

# Перезапускаем nginx
systemctl reload nginx
```

---

## Шаг 7: Получение SSL сертификата

```bash
# Создаём директорию для certbot
mkdir -p /var/www/certbot

# Получаем сертификат
certbot certonly --webroot -w /var/www/certbot \
  -d trenki.app -d www.trenki.app \
  --email ваш@email.com --agree-tos --non-interactive

# Восстанавливаем SSL строки в конфиге
sed -i 's/#ssl_certificate/ssl_certificate/g' /etc/nginx/sites-available/trenki.app
sed -i 's/#listen 443 ssl/listen 443 ssl/g' /etc/nginx/sites-available/trenki.app

# Проверяем и перезапускаем
nginx -t && systemctl reload nginx
```

---

## Шаг 8: Настройка DNS (выполнить в панели reg.ru)

1. Зайдите в управление доменом **trenki.app** на reg.ru
2. Добавьте DNS-записи:
   - **A-запись**: `@` → `89.104.70.39`
   - **A-запись**: `www` → `89.104.70.39`
3. TTL: 300-600 секунд
4. Сохраните изменения

Подождите 5-10 минут для распространения DNS.

---

## Шаг 9: Проверка

```bash
# На сервере
curl -I http://trenki.app
curl -I https://trenki.app

# Проверка контейнеров
docker compose ps
```

Откройте в браузере: **https://trenki.app**

---

## Полезные команды

### Просмотр логов
```bash
docker compose logs -f web
docker compose logs -f bot
```

### Перезапуск приложения
```bash
docker compose restart
```

### Обновление кода
```bash
cd ~/trenki
git pull
docker compose build
docker compose up -d
```

### Просмотр использования ресурсов
```bash
docker stats
htop  # apt install htop
```

### Остановка всех контейнеров
```bash
docker compose down
```

---

## Troubleshooting

### Приложение не запускается
```bash
docker compose logs web
# Проверьте DATABASE_URL и другие переменные в .env
```

### Nginx выдаёт 502 Bad Gateway
```bash
# Проверьте, что контейнер web запущен
docker compose ps
# Проверьте, что порт 3000 занят
netstat -tulpn | grep 3000
```

### SSL не работает
```bash
# Проверьте сертификаты
ls -l /etc/letsencrypt/live/trenki.app/
# Проверьте конфиг nginx
nginx -t
```

### DNS не обновляется
```bash
# Проверьте DNS
dig +short trenki.app
nslookup trenki.app
# Очистите кэш DNS на локальной машине
```

---

## Безопасность (рекомендации)

1. **Смените пароль root**:
   ```bash
   passwd
   ```

2. **Добавьте SSH-ключ** (с локальной машины):
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519_trenki.pub root@89.104.70.39
   ```

3. **Отключите вход по паролю**:
   ```bash
   nano /etc/ssh/sshd_config
   # Установите: PasswordAuthentication no
   systemctl restart sshd
   ```

4. **Создайте непривилегированного пользователя**:
   ```bash
   adduser deploy
   usermod -aG docker deploy
   ```
