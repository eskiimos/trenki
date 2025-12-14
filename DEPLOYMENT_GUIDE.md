# 🚀 Руководство по развертыванию Trenki на сервере

Это руководство описывает несколько способов развертывания приложения Trenki на вашем сервере.

## 📋 Предварительные требования

### Минимальные требования к серверу:

- **ОС:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **RAM:** Минимум 2GB (рекомендуется 4GB)
- **CPU:** 2+ ядра
- **Диск:** 20GB свободного места
- **Порты:** 80, 443, 3000 (для Next.js)

### Что нужно подготовить:

1. ✅ Домен (например, `trenki.yourdomain.com`)
2. ✅ SSL сертификат (можно получить бесплатно через Let's Encrypt)
3. ✅ Доступ к серверу по SSH
4. ✅ Переменные окружения (см. `.env.example`)

---

## 🎯 Выбор метода развертывания

Выберите один из трех методов:

| Метод | Сложность | Изоляция | Автозапуск | Рекомендуется для |
|-------|-----------|----------|------------|-------------------|
| **Docker** | Средняя | ✅ Высокая | ✅ Да | Production, легкое обновление |
| **PM2** | Низкая | ❌ Нет | ✅ Да | Быстрое развертывание |
| **systemd** | Средняя | ❌ Нет | ✅ Да | Интеграция с системой |

---

## 🐳 Метод 1: Развертывание через Docker (рекомендуется)

### Преимущества:
- ✅ Изоляция приложения
- ✅ Легкое обновление
- ✅ Одинаковое окружение везде
- ✅ Простое масштабирование

### Шаг 1: Подготовка сервера

```bash
# Подключитесь к серверу
ssh user@your-server-ip

# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите Git
sudo apt install -y git
```

### Шаг 2: Клонирование проекта

```bash
# Клонируйте репозиторий
cd /opt
sudo git clone https://github.com/yourusername/trenki.git
cd trenki

# Дайте права пользователю
sudo chown -R $USER:$USER /opt/trenki
```

### Шаг 3: Настройка переменных окружения

```bash
# Создайте .env файл
cp .env.example .env
nano .env
```

Заполните переменные:

```env
DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY
KINESCOPE_API_KEY=your_kinescope_api_key
BOT_TOKEN=your_bot_token
NEXT_PUBLIC_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
```

### Шаг 4: Запуск через Docker

```bash
# Запустите скрипт развертывания
./deploy/deploy-docker.sh
```

Этот скрипт:
1. Установит Docker (если не установлен)
2. Соберет образы приложения
3. Запустит контейнеры
4. Проверит статус

### Шаг 5: Проверка

```bash
# Проверьте статус контейнеров
docker compose ps

# Просмотрите логи
docker compose logs -f web
docker compose logs -f bot
```

### Управление Docker

```bash
# Остановить
docker compose down

# Запустить
docker compose up -d

# Перезапустить
docker compose restart

# Обновить приложение
./deploy/update.sh
```

---

## 📦 Метод 2: Развертывание через PM2

### Преимущества:
- ✅ Простота использования
- ✅ Автоматический перезапуск
- ✅ Мониторинг процессов
- ✅ Управление логами

### Шаг 1: Подготовка сервера

```bash
# Подключитесь к серверу
ssh user@your-server-ip

# Обновите систему
sudo apt update && sudo apt upgrade -y

# Установите необходимые пакеты
sudo apt install -y git curl
```

### Шаг 2: Клонирование проекта

```bash
cd /opt
sudo git clone https://github.com/yourusername/trenki.git
cd trenki
sudo chown -R $USER:$USER /opt/trenki
```

### Шаг 3: Настройка переменных окружения

```bash
cp .env.example .env
nano .env
```

Заполните переменные (как в методе с Docker)

### Шаг 4: Запуск через PM2

```bash
# Запустите скрипт развертывания
./deploy/deploy-pm2.sh
```

Этот скрипт:
1. Установит Node.js 20 (если не установлен)
2. Установит PM2
3. Установит зависимости
4. Соберет приложение
5. Запустит через PM2
6. Настроит автозапуск

### Шаг 5: Проверка

```bash
# Проверьте статус
pm2 status

# Просмотрите логи
pm2 logs

# Мониторинг
pm2 monit
```

### Управление PM2

```bash
# Остановить все
pm2 stop all

# Запустить все
pm2 start all

# Перезапустить все
pm2 restart all

# Перезапустить конкретное приложение
pm2 restart trenki-web
pm2 restart trenki-bot

# Обновить приложение
./deploy/update.sh
```

---

## ⚙️ Метод 3: Развертывание через systemd

### Преимущества:
- ✅ Нативная интеграция с системой
- ✅ Автозапуск при загрузке
- ✅ Управление через systemctl
- ✅ Централизованные логи

### Шаги аналогичны PM2, но используйте:

```bash
./deploy/deploy-systemd.sh
```

### Управление systemd

```bash
# Статус
sudo systemctl status trenki-web
sudo systemctl status trenki-bot

# Остановить
sudo systemctl stop trenki-web
sudo systemctl stop trenki-bot

# Запустить
sudo systemctl start trenki-web
sudo systemctl start trenki-bot

# Перезапустить
sudo systemctl restart trenki-web
sudo systemctl restart trenki-bot

# Логи
sudo journalctl -u trenki-web -f
sudo journalctl -u trenki-bot -f

# Обновить приложение
./deploy/update.sh
```

---

## 🌐 Настройка Nginx

После развертывания настройте Nginx как reverse proxy:

### Шаг 1: Установка Nginx

```bash
sudo apt install -y nginx
```

### Шаг 2: Настройка сайта

```bash
# Скопируйте конфигурацию
sudo cp deploy/nginx.conf /etc/nginx/sites-available/trenki

# Отредактируйте домен
sudo nano /etc/nginx/sites-available/trenki
# Замените yourdomain.com на ваш домен

# Активируйте сайт
sudo ln -s /etc/nginx/sites-available/trenki /etc/nginx/sites-enabled/

# Проверьте конфигурацию
sudo nginx -t

# Перезапустите Nginx
sudo systemctl restart nginx
```

### Шаг 3: Получение SSL сертификата

```bash
# Установите Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получите сертификат
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Проверьте автообновление
sudo certbot renew --dry-run
```

---

## 🔧 Настройка Telegram бота

### Шаг 1: Настройка домена в BotFather

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте: `/setdomain`
3. Выберите вашего бота
4. Укажите домен: `yourdomain.com` (без https://)

### Шаг 2: Настройка webhook (опционально)

Если ваш бот использует webhook вместо polling:

```bash
# Установите webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/webhook"}'

# Проверьте webhook
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

---

## 🔐 Безопасность

### Firewall (UFW)

```bash
# Установите UFW
sudo apt install -y ufw

# Разрешите SSH
sudo ufw allow 22/tcp

# Разрешите HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Активируйте firewall
sudo ufw enable

# Проверьте статус
sudo ufw status
```

### Fail2ban

```bash
# Установите Fail2ban
sudo apt install -y fail2ban

# Создайте конфигурацию
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Запустите сервис
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 📊 Мониторинг

### Docker

```bash
# Использование ресурсов
docker stats

# Логи с метками времени
docker compose logs -f --timestamps

# Только последние 100 строк
docker compose logs --tail=100
```

### PM2

```bash
# Веб-интерфейс мониторинга
pm2 web

# Статистика процессов
pm2 describe trenki-web
```

### systemd

```bash
# Логи с фильтрацией
sudo journalctl -u trenki-web --since "1 hour ago"

# Логи в реальном времени
sudo journalctl -u trenki-web -u trenki-bot -f
```

---

## 🔄 Обновление приложения

Используйте универсальный скрипт обновления:

```bash
cd /opt/trenki
./deploy/update.sh
```

Скрипт автоматически определит метод развертывания и выполнит обновление.

---

## 🐛 Решение проблем

### Приложение не запускается

```bash
# Проверьте логи
# Docker:
docker compose logs

# PM2:
pm2 logs

# systemd:
sudo journalctl -u trenki-web -n 50
```

### Ошибки базы данных

```bash
# Проверьте DATABASE_URL в .env
cat .env | grep DATABASE_URL

# Проверьте подключение к Prisma
npx prisma db push
```

### Порт 3000 занят

```bash
# Найдите процесс
sudo lsof -i :3000

# Убейте процесс
sudo kill -9 <PID>
```

### Nginx не может подключиться к приложению

```bash
# Проверьте, что приложение запущено
curl http://localhost:3000

# Проверьте конфигурацию Nginx
sudo nginx -t

# Проверьте логи Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи приложения
2. Убедитесь, что все переменные окружения заданы
3. Проверьте, что порты не заняты
4. Проверьте права доступа к файлам

---

## ✅ Чек-лист после развертывания

- [ ] Приложение запущено и доступно
- [ ] SSL сертификат настроен
- [ ] Telegram бот работает
- [ ] Домен настроен в BotFather
- [ ] Firewall настроен
- [ ] Автозапуск при перезагрузке сервера работает
- [ ] Логи записываются
- [ ] Backup базы данных настроен
- [ ] Мониторинг работает

---

## 🎉 Готово!

Ваше приложение Trenki теперь работает на сервере!

Доступ: `https://yourdomain.com`
