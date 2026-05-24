# 🚀 ИНСТРУКЦИЯ: Развертывание на trenki.app

## 📋 Данные сервера
- **IP**: 83.166.245.178
- **Домен**: trenki.app
- **Логин**: root
- **Пароль**: o4Qa1jibVGnxXMHk

---

## 🎯 ПОШАГОВАЯ ИНСТРУКЦИЯ

### Шаг 1: Загрузка проекта на сервер (на Mac)

```bash
# Запустите скрипт загрузки
./deploy/deploy-to-server.sh
```

Этот скрипт:
- Создаст архив проекта
- Загрузит его на сервер
- Распакует в `/opt/trenki`
- Скопирует `.env.production` в `.env`

**Пароль**: `o4Qa1jibVGnxXMHk`

---

### Шаг 2: Подключение к серверу

```bash
ssh root@83.166.245.178
```

**Пароль**: `o4Qa1jibVGnxXMHk`

---

### Шаг 3: Установка Docker (на сервере)

```bash
# Перейдите в директорию проекта
cd /opt/trenki

# Запустите скрипт развертывания
./deploy/deploy-on-server.sh
```

При первом запуске скрипт:
- Установит Docker
- Попросит перелогиниться

После установки Docker:
```bash
# Выйдите и зайдите снова
logout
ssh root@83.166.245.178
cd /opt/trenki

# Запустите снова
./deploy/deploy-on-server.sh
```

---

### Шаг 4: Проверка работы Docker

```bash
# Проверьте статус контейнеров
docker compose ps

# Смотрите логи
docker compose logs -f web
docker compose logs -f bot

# Проверьте, что приложение отвечает
curl http://localhost:3000
```

---

### Шаг 5: Установка Nginx

```bash
# Обновите систему
apt update && apt upgrade -y

# Установите Nginx
apt install -y nginx

# Создайте директорию для certbot
mkdir -p /var/www/certbot
```

---

### Шаг 6: Настройка Nginx

```bash
# Скопируйте конфигурацию
cp /opt/trenki/deploy/nginx-trenki.app.conf /etc/nginx/sites-available/trenki.app

# Временно отключим SSL для получения сертификата
# Создайте упрощенную конфигурацию для HTTP
cat > /etc/nginx/sites-available/trenki.app << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name trenki.app www.trenki.app;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Активируйте сайт
ln -s /etc/nginx/sites-available/trenki.app /etc/nginx/sites-enabled/

# Удалите дефолтный сайт
rm -f /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
nginx -t

# Перезапустите Nginx
systemctl restart nginx
systemctl enable nginx
```

---

### Шаг 7: Проверка DNS

Убедитесь, что домен **trenki.app** указывает на **83.166.245.178**

Проверка:
```bash
# На вашем Mac или на сервере
dig trenki.app +short
# Должно показать: 83.166.245.178

# Или
ping trenki.app
```

Если DNS не настроен:
1. Зайдите в панель управления доменом
2. Добавьте A-запись: `trenki.app` → `83.166.245.178`
3. Добавьте A-запись: `www.trenki.app` → `83.166.245.178`
4. Подождите 5-10 минут

---

### Шаг 8: Получение SSL сертификата

```bash
# Установите Certbot
apt install -y certbot python3-certbot-nginx

# Получите сертификат
certbot --nginx -d trenki.app -d www.trenki.app

# Введите email для уведомлений
# Согласитесь с Terms of Service (Y)
# Откажитесь от рассылки (N) или согласитесь (Y)

# Certbot автоматически настроит SSL в Nginx
```

После получения сертификата:
```bash
# Обновите конфигурацию на полную версию с SSL
cp /opt/trenki/deploy/nginx-trenki.app.conf /etc/nginx/sites-available/trenki.app

# Проверьте
nginx -t

# Перезапустите
systemctl restart nginx
```

---

### Шаг 9: Настройка Firewall

```bash
# Установите UFW
apt install -y ufw

# Разрешите необходимые порты
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# Активируйте (ВНИМАНИЕ: убедитесь что SSH порт разрешен!)
ufw --force enable

# Проверьте статус
ufw status
```

---

### Шаг 10: Настройка Telegram бота

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте: `/setdomain`
3. Выберите бота: `@trenkiapp_bot`
4. Укажите домен: `trenki.app` (без https://)

Подтверждение:
```
BotFather: ✅ Success! Users will be able to log in from:
           trenki.app
```

---

### Шаг 11: Проверка работы

```bash
# На сервере проверьте логи
docker compose logs -f

# На Mac или в браузере
curl https://trenki.app
# Должен вернуть HTML страницу

# Откройте в браузере
open https://trenki.app
```

Проверьте:
- ✅ Сайт открывается через HTTPS
- ✅ SSL сертификат валиден (зеленый замок)
- ✅ Telegram Login кнопка появляется
- ✅ Вход через Telegram работает

---

## 🔧 Управление приложением

```bash
# Подключитесь к серверу
ssh root@83.166.245.178

# Перейдите в директорию
cd /opt/trenki

# Посмотрите статус
docker compose ps

# Логи
docker compose logs -f web
docker compose logs -f bot

# Перезапуск
docker compose restart

# Остановка
docker compose down

# Запуск
docker compose up -d

# Обновление (когда обновите код)
git pull  # если используете git
# или загрузите новую версию через ./deploy/deploy-to-server.sh
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 🔄 Автообновление SSL

Certbot автоматически настраивает обновление. Проверьте:

```bash
# Проверка автообновления
systemctl status certbot.timer

# Тест обновления (не обновляет реально)
certbot renew --dry-run
```

---

## 📊 Мониторинг

```bash
# Использование ресурсов Docker
docker stats

# Использование диска
df -h

# Использование памяти
free -h

# Процессы
htop  # если установлен: apt install htop
```

---

## 🐛 Решение проблем

### Приложение не отвечает
```bash
docker compose logs web
docker compose restart
```

### Nginx не запускается
```bash
nginx -t
systemctl status nginx
tail -f /var/log/nginx/error.log
```

### SSL не работает
```bash
certbot certificates
certbot renew --force-renewal
```

### Порт занят
```bash
lsof -i :3000
lsof -i :80
lsof -i :443
```

---

## ✅ Чек-лист

После завершения всех шагов:

- [ ] Проект загружен на сервер
- [ ] Docker установлен и работает
- [ ] Контейнеры запущены
- [ ] Nginx установлен и настроен
- [ ] DNS указывает на сервер
- [ ] SSL сертификат получен
- [ ] Firewall настроен
- [ ] Домен настроен в BotFather
- [ ] Сайт открывается через HTTPS
- [ ] Telegram логин работает

---

## 🎉 Готово!

Ваше приложение работает на **https://trenki.app**

Для обновления приложения просто запустите заново:
```bash
./deploy/deploy-to-server.sh  # на Mac
# затем на сервере:
cd /opt/trenki && docker compose down && docker compose build && docker compose up -d
```
