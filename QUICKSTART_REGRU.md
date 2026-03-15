# 🚀 Быстрый старт развертывания на reg.ru

## За 5 минут:

### 1️⃣ Подключиться к серверу

```bash
ssh root@89.108.113.230
```
Введи пароль (из панели reg.ru)

### 2️⃣ Загрузить и запустить скрипт

```bash
cd /tmp
curl -o deploy.sh https://raw.githubusercontent.com/eskiimos/trenki/main/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

**Или вручную:**

```bash
git clone https://github.com/eskiimos/trenki.git /home/trenki
cd /home/trenki
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 📝 Нужны переменные окружения

После развертывания отредактируй файл:

```bash
nano /home/trenki/.env.production
```

Замени все `your-*` значения на реальные:

```env
# Скопируй из Vercel:
TELEGRAM_BOT_TOKEN=123456...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_KINESCOPE_API_KEY=...
NEXTAUTH_SECRET=... (сгенерируй: openssl rand -base64 32)
```

После сохранения:

```bash
docker-compose -f docker-compose.production.yml restart app
```

---

## ✅ Проверить статус

```bash
# Увидеть логи
docker-compose -f docker-compose.production.yml logs -f app

# Проверить контейнеры
docker-compose -f docker-compose.production.yml ps

# Проверить доступность
curl https://89.108.113.230 -k
```

---

## 🔒 SSL сертификат

**Сейчас:** самоподписанный (для тестирования)

**Для продакшена с доменом:**

```bash
apt install certbot python3-certbot-nginx -y
certbot certonly --standalone -d your-domain.com

# Обнови nginx.conf с путями к новым сертификатам
# Перезагрузи nginx
docker-compose -f docker-compose.production.yml restart nginx
```

---

## 🗄️ БД миграции

```bash
# Если нужно создать таблицы
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy

# Если нужно сбросить БД (⚠️ осторожно!)
docker-compose -f docker-compose.production.yml exec app npx prisma migrate reset
```

---

## 📊 Файлы для развертывания

В репозитории уже есть:

- ✅ `docker-compose.production.yml` — Docker конфигурация
- ✅ `nginx.conf` — Nginx конфигурация
- ✅ `.env.production.example` — Шаблон переменных
- ✅ `deploy.sh` — Автоматический скрипт
- ✅ `DEPLOYMENT_REGRU.md` — Подробная инструкция
- ✅ `Dockerfile` — Dockerfile приложения

---

## 🆘 Помощь

**Монитор логи:**
```bash
docker-compose -f docker-compose.production.yml logs -f
```

**Перезагрузить приложение:**
```bash
docker-compose -f docker-compose.production.yml restart app
```

**Остановить все:**
```bash
docker-compose -f docker-compose.production.yml down
```

**Обновить код из GitHub:**
```bash
cd /home/trenki
git pull
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d
```

---

✨ **Готово! Приложение должно быть доступно по https://89.108.113.230**

Если что-то не работает — посмотри логи:
```bash
docker-compose -f docker-compose.production.yml logs app | tail -50
```
