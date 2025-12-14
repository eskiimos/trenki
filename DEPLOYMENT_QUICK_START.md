# 🚀 Быстрый старт развертывания

## Выбор метода

```bash
# Docker (рекомендуется)
./deploy/deploy-docker.sh

# PM2 (простой)
./deploy/deploy-pm2.sh

# systemd (системный)
./deploy/deploy-systemd.sh
```

## Подготовка

```bash
# 1. Клонируйте проект
git clone https://github.com/yourusername/trenki.git
cd trenki

# 2. Создайте .env
cp .env.example .env
nano .env

# 3. Заполните переменные:
# DATABASE_URL=...
# KINESCOPE_API_KEY=...
# BOT_TOKEN=...
# NEXT_PUBLIC_BOT_USERNAME=...
# NEXT_PUBLIC_APP_URL=...
```

## Управление

### Docker
```bash
docker compose up -d      # Запустить
docker compose down       # Остановить
docker compose logs -f    # Логи
docker compose ps         # Статус
```

### PM2
```bash
pm2 start all     # Запустить
pm2 stop all      # Остановить
pm2 restart all   # Перезапустить
pm2 logs          # Логи
pm2 status        # Статус
```

### systemd
```bash
sudo systemctl start trenki-web    # Запустить
sudo systemctl stop trenki-web     # Остановить
sudo systemctl restart trenki-web  # Перезапустить
sudo journalctl -u trenki-web -f   # Логи
sudo systemctl status trenki-web   # Статус
```

## Обновление

```bash
./deploy/update.sh
```

## Nginx

```bash
# Установить
sudo apt install nginx

# Настроить
sudo cp deploy/nginx.conf /etc/nginx/sites-available/trenki
sudo ln -s /etc/nginx/sites-available/trenki /etc/nginx/sites-enabled/
sudo nano /etc/nginx/sites-available/trenki  # изменить домен
sudo nginx -t
sudo systemctl restart nginx
```

## SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Проверка работы

```bash
# Проверьте локально
curl http://localhost:3000

# Проверьте через домен
curl https://yourdomain.com
```

## Проблемы?

Смотрите подробное руководство: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
