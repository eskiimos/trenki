# 🚀 Быстрый старт развёртывания Trenki

## Данные сервера
```
IP: YOUR_SERVER_IP
Логин: root
Домен: ваш-домен.ru
```

## Подключение
```bash
ssh root@YOUR_SERVER_IP
```

## Автоматическое развёртывание (рекомендуется)
```bash
# На сервере
curl -fsSL https://raw.githubusercontent.com/eskiimos/trenki/main/deploy/auto-deploy.sh -o auto-deploy.sh
bash auto-deploy.sh
```

## Или вручную пошагово:

### 1. Базовая настройка
```bash
apt update && apt -y upgrade
apt -y install git curl ufw nginx certbot
ufw allow OpenSSH && ufw allow 80 && ufw allow 443
echo "y" | ufw enable
```

### 2. Установка Docker
```bash
curl -fsSL https://get.docker.com | sh
```

### 3. Клонирование и настройка
```bash
cd ~
git clone https://github.com/eskiimos/trenki.git
cd trenki
nano .env  # Скопируйте значения из вашего локального .env
```

### 4. Запуск приложения
```bash
docker compose build
docker compose up -d
docker compose ps
```

### 5. Настройка Nginx
```bash
bash deploy/setup-nginx.sh
```

### 6. Настройка DNS
В панели DNS:
- A @ → YOUR_SERVER_IP
- A www → YOUR_SERVER_IP

### 7. Получение SSL
```bash
bash deploy/setup-ssl.sh
```

## Проверка
```bash
curl https://trenki.app
docker compose logs -f web
```

## Обновление
```bash
cd ~/trenki
git pull
docker compose build
docker compose up -d
```

## Полная документация
См. [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)
