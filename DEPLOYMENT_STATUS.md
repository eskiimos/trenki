# Статус развертывания Trenki на reg.ru

## Текущее состояние ✅

**Дата:** 12 декабря 2025, 10:11

### Что работает:
- ✅ Сервер доступен: 83.166.245.178
- ✅ Docker установлен и запущен
- ✅ Проект загружен в /opt/trenki
- ✅ Telegram бот собран (образ trenki-bot:latest, 267MB)
- ✅ .env.production настроен со всеми ключами
- 🔄 Web приложение собирается (в процессе ~16+ минут)

### Что в процессе:
Сборка Next.js приложения запущена в screen сессии `docker-build`.
Текущий этап: установка зависимостей (apk add libc6-compat)

## Как проверить статус

### 1. Автоматическая проверка
```bash
./deploy/check-status.sh
```

### 2. Проверка прогресса сборки
```bash
ssh root@83.166.245.178 "screen -S docker-build -X hardcopy /tmp/screen-output.txt && tail -30 /tmp/screen-output.txt"
```

### 3. Проверка запущенных контейнеров
```bash
ssh root@83.166.245.178 "docker ps -a"
```

## Когда сборка завершится

### Признаки успешной сборки:
1. Файл `/tmp/build-final.log` будет содержать "DONE"
2. Команда `docker ps` покажет 2 работающих контейнера:
   - `trenki-web` (порт 3000)
   - `trenki-bot` (без портов)
3. Образ `trenki-web` появится в `docker images`

### Проверить можно так:
```bash
./deploy/check-status.sh
```

Если увидите 2 контейнера со STATUS "Up", значит всё готово!

## Следующие шаги после сборки

### 1. Установить Nginx
```bash
ssh root@83.166.245.178 "apt update && apt install -y nginx"
```

### 2. Настроить Nginx
```bash
ssh root@83.166.245.178 "cp /opt/trenki/deploy/nginx-trenki.app.conf /etc/nginx/sites-available/trenki.app && ln -s /etc/nginx/sites-available/trenki.app /etc/nginx/sites-enabled/ && nginx -t && systemctl restart nginx"
```

### 3. Получить SSL сертификат
```bash
ssh root@83.166.245.178 "apt install -y certbot python3-certbot-nginx && certbot --nginx -d trenki.app -d www.trenki.app --non-interactive --agree-tos -m your@email.com"
```

### 4. Настроить домен в Telegram боте
1. Открыть @BotFather в Telegram
2. Отправить `/setdomain`
3. Выбрать @trenkibot  
4. Ввести `trenki.app`

### 5. Проверить работу
```bash
curl https://trenki.app
```

## Если что-то пошло не так

### Сборка застряла (>30 минут)
```bash
# Убить процесс и перезапустить
ssh root@83.166.245.178 "screen -XS docker-build quit && cd /opt/trenki && screen -dmS docker-build bash -c 'docker compose build && docker compose up -d'"
```

### Проверить логи
```bash
ssh root@83.166.245.178 "cd /opt/trenki && docker compose logs"
```

### Перезапустить контейнеры
```bash
ssh root@83.166.245.178 "cd /opt/trenki && docker compose down && docker compose up -d"
```

## Автоматическое обновление проекта

После первой сборки обновления будут быстрее. Используйте:

```bash
./deploy/upload-expect.exp
ssh root@83.166.245.178 "cd /opt/trenki && docker compose up -d --build"
```

---

**Примечание:** Первая сборка может занять 20-30 минут из-за загрузки всех зависимостей Next.js и создания production build.
