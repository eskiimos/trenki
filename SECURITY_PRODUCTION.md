# 🔐 Рекомендации по безопасности для production

## 🔑 Переменные окружения

### ❌ НЕ ДЕЛАЙТЕ:
- Не храните `.env` в Git
- Не используйте одинаковые токены для разработки и production
- Не передавайте секреты в URL или логах

### ✅ ДЕЛАЙТЕ:
- Храните `.env` только на сервере
- Используйте разные BOT_TOKEN для development и production
- Регулярно ротируйте API ключи

## 🛡️ Firewall (UFW)

```bash
# Установка и базовая настройка
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешите только нужные порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Активируйте
sudo ufw enable
sudo ufw status verbose
```

## 🚫 Fail2ban (защита от брутфорса)

```bash
# Установка
sudo apt install fail2ban

# Создание конфигурации для SSH
sudo nano /etc/fail2ban/jail.local
```

Добавьте:
```ini
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 3600
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 🔒 SSH Безопасность

```bash
sudo nano /etc/ssh/sshd_config
```

Настройте:
```bash
# Отключите вход под root
PermitRootLogin no

# Используйте только ключи (не пароли)
PasswordAuthentication no
PubkeyAuthentication yes

# Смените порт SSH (опционально)
Port 2222

# Ограничьте количество попыток
MaxAuthTries 3
```

```bash
sudo systemctl restart sshd
```

## 🔐 SSL/TLS

### Используйте современные протоколы

В Nginx конфигурации уже настроено:
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

### Автообновление сертификатов

```bash
# Let's Encrypt автоматически обновляется
sudo certbot renew --dry-run

# Проверьте cron задачу
sudo systemctl status certbot.timer
```

## 🗄️ База данных

### Prisma Accelerate
- ✅ Уже использует зашифрованное соединение
- ✅ Не требует открытых портов на сервере
- ✅ Встроенное кэширование

### Если используете локальную БД:
```bash
# Не открывайте порт PostgreSQL наружу
sudo ufw deny 5432/tcp

# Используйте сильные пароли
# Регулярно делайте backup
```

## 🔍 Мониторинг и логи

### Настройте ротацию логов

```bash
sudo nano /etc/logrotate.d/trenki
```

```
/var/log/nginx/trenki-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/opt/trenki/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
}
```

### Мониторинг подозрительной активности

```bash
# Установите logwatch
sudo apt install logwatch

# Настройте ежедневные отчеты
sudo logwatch --output mail --mailto your@email.com --detail high
```

## 🚨 Rate Limiting в Nginx

```nginx
# Добавьте в http блок
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
    
    server {
        # API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://localhost:3000;
        }
        
        # Login endpoint
        location /api/auth/ {
            limit_req zone=login_limit burst=5 nodelay;
            proxy_pass http://localhost:3000;
        }
    }
}
```

## 🔄 Автоматическое обновление системы

```bash
# Установите unattended-upgrades
sudo apt install unattended-upgrades

# Настройте
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📦 Docker Security

Если используете Docker:

```bash
# Запускайте контейнеры не от root
# (уже настроено в Dockerfile)

# Ограничьте ресурсы
docker compose config | grep -A 5 "resources"

# Регулярно обновляйте образы
docker compose pull
docker compose up -d
```

## 🔐 Telegram Bot Security

### Проверка подписи
В коде уже реализована проверка:
```typescript
// src/app/api/auth/telegram/route.ts
// Проверяет хэш от Telegram
```

### Настройка домена в BotFather
- ✅ Установите домен в BotFather: `/setdomain`
- ✅ Используйте только HTTPS

## 🛠️ Backup

### Создайте скрипт backup

```bash
#!/bin/bash
# /opt/trenki/backup.sh

BACKUP_DIR="/backup/trenki"
DATE=$(date +%Y%m%d_%H%M%S)

# Создайте директорию
mkdir -p $BACKUP_DIR

# Backup .env
cp .env $BACKUP_DIR/.env.$DATE

# Backup загруженных файлов
tar -czf $BACKUP_DIR/files_$DATE.tar.gz public/images/

# Удалите старые backup (старше 30 дней)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Настройте cron

```bash
crontab -e
```

Добавьте:
```
# Backup каждый день в 2:00
0 2 * * * /opt/trenki/backup.sh >> /var/log/trenki-backup.log 2>&1
```

## 📋 Чек-лист безопасности

- [ ] Firewall настроен (UFW)
- [ ] Fail2ban установлен и работает
- [ ] SSH защищен (ключи, не root)
- [ ] SSL/TLS настроен (Let's Encrypt)
- [ ] Сильные пароли для всех сервисов
- [ ] Переменные окружения защищены
- [ ] Rate limiting включен в Nginx
- [ ] Логи ротируются
- [ ] Backup настроен
- [ ] Мониторинг работает
- [ ] Автообновления включены
- [ ] Telegram Bot домен настроен

## 🚨 Что делать при взломе

1. **Немедленно**:
   - Отключите сервер от сети
   - Смените все пароли и токены
   - Проверьте логи: `/var/log/auth.log`, `/var/log/nginx/`

2. **Анализ**:
   - Найдите точку входа
   - Проверьте изменения в файлах: `sudo find / -mtime -1`

3. **Восстановление**:
   - Восстановите из backup
   - Обновите все пакеты
   - Усильте безопасность

4. **Уведомления**:
   - Уведомите пользователей
   - Смените все API ключи
   - Обновите SSL сертификаты

## 📞 Дополнительные ресурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Nginx Security](https://www.nginx.com/blog/mitigating-ddos-attacks-with-nginx-and-nginx-plus/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
