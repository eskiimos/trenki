# Развертывание Trenki на reg.ru облаке

## 📋 Данные сервера

```
VPS IP: 89.108.113.230
VPS Пароль: (из панели reg.ru)
Регион: Москва-2

БД Хост: 79.174.88.242
БД Порт: 17396 (Master)
БД Имя: trenki
БД Пользователь: trenki_user
БД Пароль: UCLwa6uf123@
```

---

## 🚀 Шаги развертывания

### 1. Подключиться по SSH

```bash
ssh root@89.108.113.230
# Введи пароль (из панели управления)
```

### 2. Установить необходимое ПО

```bash
# Обновить систему
apt update && apt upgrade -y

# Установить Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установить Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Проверить
docker --version
docker-compose --version
```

### 3. Загрузить репозиторий

```bash
cd /home
git clone https://github.com/eskiimos/trenki.git
cd trenki
```

### 4. Создать .env файл для production

```bash
cat > .env.production << 'EOF'
# Next.js
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://89.108.113.230
NEXTAUTH_SECRET=your-secret-key-change-this
NEXTAUTH_URL=https://89.108.113.230

# Database
DATABASE_URL="postgresql://trenki_user:UCLwa6uf123@79.174.88.242:17396/trenki"

# Telegram Bot (скопируй из Vercel)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_BOT_USERNAME=your_bot_username

# Cloudinary (для загрузки файлов)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Другие переменные (скопируй из .env.local)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-key
NEXT_PUBLIC_KINESCOPE_API_KEY=your-kinescope-key

EOF
```

### 5. Создать docker-compose.yml

Используй файл `docker-compose.production.yml` из репозитория или создай новый с конфигом ниже.

### 6. Запустить контейнеры

```bash
docker-compose -f docker-compose.production.yml up -d
```

### 7. Проверить логи

```bash
docker-compose logs -f
```

---

## 🔒 SSL Сертификат (Let's Encrypt)

Если нет доменного имени, используй IP с self-signed сертификатом (тесты).

Если есть домен:

```bash
# Установить Certbot
apt install certbot python3-certbot-nginx -y

# Получить сертификат
certbot certonly --standalone -d your-domain.com

# Обновлять сертификаты автоматически
systemctl enable certbot.timer
```

---

## 📊 Мониторинг

```bash
# Проверить статус контейнеров
docker-compose ps

# Просмотреть логи
docker-compose logs -f app

# Перезагрузить приложение
docker-compose restart app

# Остановить
docker-compose down
```

---

## ⚠️ Важно

1. **Переменные окружения:** Замени все `your-*` значения на реальные (скопируй из Vercel)
2. **Пароль БД:** УЖЕ указан в этом файле, просто убедись что совпадает
3. **Backup БД:** Регулярно делай бэкапы в панели reg.ru
4. **Firewall:** Открой 80 и 443 порты в панели управления сетью

---

## 🔗 Полезные команды

```bash
# Заново собрать образ (после обновления кода)
git pull
docker-compose build --no-cache
docker-compose up -d

# Миграция БД
docker-compose exec app npx prisma migrate deploy

# Просмотр размера контейнеров
docker system df

# Очистить старые образы
docker system prune -a
```

---

## 📝 Что дальше?

1. Проверь доступность приложения: http://89.108.113.230
2. Проверь логи приложения
3. Проверь подключение к БД
4. Настрой SSL сертификат (если есть домен)
5. Настрой автоматический backup БД

**Готов помочь с любым шагом! Скажи, где застрял.** 👍
