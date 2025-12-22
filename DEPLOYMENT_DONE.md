# 🎉 Настройка для развертывания на вашем сервере завершена!

## ✅ Что было сделано

Я настроил полную инфраструктуру для развертывания приложения Trenki на вашем сервере. Вот что создано:

### 📁 Созданные файлы

#### 🐳 Docker конфигурация
- `Dockerfile` - образ для Next.js приложения
- `Dockerfile.bot` - образ для Telegram бота
- `docker-compose.yml` - оркестрация контейнеров
- `.dockerignore` - оптимизация сборки

#### 🚀 Скрипты развертывания
- `deploy/deploy-docker.sh` - развертывание через Docker ⭐ **РЕКОМЕНДУЕТСЯ**
- `deploy/deploy-pm2.sh` - развертывание через PM2
- `deploy/deploy-systemd.sh` - развертывание через systemd
- `deploy/update.sh` - универсальный скрипт обновления
- `deploy/check-deployment-ready.sh` - проверка готовности

#### ⚙️ Конфигурация
- `ecosystem.config.js` - конфигурация PM2
- `systemd/trenki-web.service` - systemd сервис для веб-приложения
- `systemd/trenki-bot.service` - systemd сервис для бота
- `deploy/nginx.conf` - конфигурация Nginx
- `.env.example` - шаблон переменных окружения

#### 📖 Документация
- `DEPLOYMENT_GUIDE.md` - полное руководство (400+ строк)
- `DEPLOYMENT_QUICK_START.md` - быстрая шпаргалка
- `DEPLOYMENT_README.md` - обзор всех файлов
- `SECURITY_PRODUCTION.md` - безопасность для production

### 🔧 Обновленные файлы
- `next.config.ts` - добавлен режим `output: 'standalone'` для Docker
- `.gitignore` - добавлены исключения для логов и PM2

---

## 🚀 Как развернуть на сервере

### Вариант 1: Docker (рекомендуется) 🐳

```bash
# 1. На сервере клонируйте проект
git clone https://github.com/yourusername/trenki.git
cd trenki

# 2. Создайте .env файл
cp .env.example .env
nano .env
# Заполните все переменные

# 3. Запустите развертывание
./deploy/deploy-docker.sh

# 4. Проверьте статус
docker compose ps
docker compose logs -f
```

### Вариант 2: PM2 (быстро и просто) 📦

```bash
# 1. Клонируйте и настройте .env (как выше)

# 2. Запустите развертывание
./deploy/deploy-pm2.sh

# 3. Проверьте статус
pm2 status
pm2 logs
```

### Вариант 3: systemd (системный) ⚙️

```bash
# 1. Клонируйте и настройте .env (как выше)

# 2. Запустите развертывание
./deploy/deploy-systemd.sh

# 3. Проверьте статус
sudo systemctl status trenki-web
sudo systemctl status trenki-bot
```

---

## 📋 Перед развертыванием

### 1. Заполните .env файл

Создайте `.env` на сервере с такими переменными:

```env
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY
KINESCOPE_API_KEY=your_kinescope_api_key_here
BOT_TOKEN=your_bot_token_from_botfather  # ⚠️ НИКОГДА НЕ ПУБЛИКУЙТЕ РЕАЛЬНЫЙ ТОКЕН!
NEXT_PUBLIC_BOT_USERNAME=trenkibot
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

⚠️ **Замените `yourdomain.com` на ваш реальный домен!**

### 2. Проверьте готовность

```bash
./deploy/check-deployment-ready.sh
```

Этот скрипт проверит все необходимые файлы и конфигурации.

### 3. Настройте DNS

Добавьте A-запись для вашего домена:
```
yourdomain.com → IP вашего сервера
```

---

## 🌐 Настройка Nginx и SSL

После развертывания приложения:

```bash
# 1. Установите Nginx
sudo apt install nginx

# 2. Скопируйте конфигурацию
sudo cp deploy/nginx.conf /etc/nginx/sites-available/trenki

# 3. Отредактируйте домен
sudo nano /etc/nginx/sites-available/trenki
# Замените yourdomain.com на ваш домен

# 4. Активируйте
sudo ln -s /etc/nginx/sites-available/trenki /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 5. Получите SSL сертификат
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🤖 Настройка Telegram бота

### Настройте домен в BotFather

1. Откройте [@BotFather](https://t.me/botfather)
2. Отправьте: `/setdomain`
3. Выберите бота: `@trenkibot`
4. Укажите домен: `yourdomain.com` (без https://)

---

## 🔐 Безопасность

После развертывания обязательно:

```bash
# 1. Настройте firewall
sudo apt install ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 2. Установите fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Подробнее в: [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md)

---

## 📊 Управление приложением

### Docker
```bash
docker compose ps          # Статус
docker compose logs -f     # Логи
docker compose restart     # Перезапуск
docker compose down        # Остановить
docker compose up -d       # Запустить
```

### PM2
```bash
pm2 status        # Статус
pm2 logs          # Логи
pm2 restart all   # Перезапуск
pm2 stop all      # Остановить
pm2 start all     # Запустить
```

### systemd
```bash
sudo systemctl status trenki-web           # Статус
sudo journalctl -u trenki-web -f           # Логи
sudo systemctl restart trenki-web          # Перезапуск
sudo systemctl stop trenki-web             # Остановить
sudo systemctl start trenki-web            # Запустить
```

---

## 🔄 Обновление приложения

Используйте универсальный скрипт:

```bash
cd /opt/trenki  # или где у вас находится проект
./deploy/update.sh
```

Скрипт автоматически:
- Подтянет код из Git
- Установит зависимости
- Пересоберет приложение
- Перезапустит сервисы

---

## 📚 Документация

Я создал подробную документацию:

1. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - полное руководство с деталями
2. **[DEPLOYMENT_QUICK_START.md](DEPLOYMENT_QUICK_START.md)** - быстрая шпаргалка
3. **[DEPLOYMENT_README.md](DEPLOYMENT_README.md)** - обзор всех файлов
4. **[SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md)** - безопасность

---

## 🎯 Рекомендуемый план действий

### Шаг 1: Подготовка (на локальной машине)
- [x] ✅ Все файлы созданы
- [ ] Проверьте, что все закоммичено в Git
- [ ] Запушьте на GitHub

### Шаг 2: На сервере
```bash
# 1. Подключитесь к серверу
ssh user@your-server-ip

# 2. Обновите систему
sudo apt update && sudo apt upgrade -y

# 3. Клонируйте проект
git clone https://github.com/yourusername/trenki.git
cd trenki

# 4. Создайте .env
cp .env.example .env
nano .env
# Заполните все переменные

# 5. Проверьте готовность
./deploy/check-deployment-ready.sh

# 6. Запустите развертывание
./deploy/deploy-docker.sh  # или другой метод
```

### Шаг 3: Настройка веб-сервера
```bash
# 1. Установите Nginx
sudo apt install nginx

# 2. Настройте Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/trenki
sudo nano /etc/nginx/sites-available/trenki  # замените домен
sudo ln -s /etc/nginx/sites-available/trenki /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 3. Получите SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Шаг 4: Безопасность
```bash
# 1. Firewall
sudo apt install ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 2. Fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Шаг 5: Telegram бот
- Откройте @BotFather
- `/setdomain` → выберите бота → укажите `yourdomain.com`

### Шаг 6: Проверка
- Откройте `https://yourdomain.com`
- Проверьте вход через Telegram
- Проверьте работу бота

---

## 🐛 Если что-то не работает

### Проверьте логи

**Docker:**
```bash
docker compose logs -f web
docker compose logs -f bot
```

**PM2:**
```bash
pm2 logs
```

**systemd:**
```bash
sudo journalctl -u trenki-web -f
sudo journalctl -u trenki-bot -f
```

### Проверьте, что приложение запущено
```bash
curl http://localhost:3000
```

### Проверьте Nginx
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

### Частые проблемы

1. **Порт 3000 занят**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **Ошибки базы данных**
   - Проверьте DATABASE_URL в .env
   - Убедитесь, что Prisma клиент сгенерирован

3. **Nginx не может подключиться**
   - Проверьте, что приложение запущено
   - Проверьте firewall

Подробнее: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#-решение-проблем)

---

## 📞 Нужна помощь?

Если возникли вопросы:
1. Проверьте логи приложения
2. Смотрите [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. Проверьте [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md)

---

## ✅ Чек-лист развертывания

- [ ] Код загружен на сервер
- [ ] .env файл создан и заполнен
- [ ] Приложение запущено (Docker/PM2/systemd)
- [ ] Nginx настроен
- [ ] SSL сертификат получен
- [ ] Домен настроен в BotFather
- [ ] Firewall настроен
- [ ] Fail2ban установлен
- [ ] Приложение доступно через домен
- [ ] Telegram логин работает
- [ ] Бот отвечает

---

## 🎉 Готово!

Все настроено! Теперь вы можете развернуть приложение на своем сервере.

**Рекомендую использовать Docker** - это самый надежный и простой в обслуживании вариант.

Удачи с развертыванием! 🚀
