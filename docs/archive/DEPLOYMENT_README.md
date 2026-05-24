# 📚 Обзор файлов развертывания

Этот документ описывает все файлы конфигурации для развертывания Trenki на сервере.

## 📁 Структура файлов

```
trenki-1/
├── 🐳 Docker
│   ├── Dockerfile              # Образ Next.js приложения
│   ├── Dockerfile.bot          # Образ Telegram бота
│   └── docker-compose.yml      # Оркестрация контейнеров
│
├── 🚀 Развертывание
│   └── deploy/
│       ├── deploy-docker.sh    # Скрипт развертывания через Docker
│       ├── deploy-pm2.sh       # Скрипт развертывания через PM2
│       ├── deploy-systemd.sh   # Скрипт развертывания через systemd
│       ├── update.sh           # Универсальный скрипт обновления
│       └── nginx.conf          # Конфигурация Nginx
│
├── ⚙️ Конфигурация
│   ├── ecosystem.config.js     # Конфигурация PM2
│   ├── next.config.ts          # Конфигурация Next.js (с standalone)
│   └── systemd/
│       ├── trenki-web.service  # Systemd сервис для веб-приложения
│       └── trenki-bot.service  # Systemd сервис для бота
│
└── 📖 Документация
    ├── DEPLOYMENT_GUIDE.md         # Полное руководство по развертыванию
    ├── DEPLOYMENT_QUICK_START.md   # Быстрый старт
    ├── SECURITY_PRODUCTION.md      # Рекомендации по безопасности
    └── .env.example                # Пример переменных окружения
```

## 🔧 Описание файлов

### Docker файлы

#### `Dockerfile`
Создает production-ready образ Next.js приложения:
- Использует multi-stage build для оптимизации размера
- Включает генерацию Prisma клиента
- Работает в standalone режиме
- Запускается от непривилегированного пользователя

#### `Dockerfile.bot`
Создает образ для Telegram бота:
- Легковесный Alpine Linux
- Node.js 20
- Только production зависимости

#### `docker-compose.yml`
Оркестрирует оба сервиса:
- Настраивает сеть между контейнерами
- Управляет переменными окружения
- Настраивает автоперезапуск

### Скрипты развертывания

#### `deploy/deploy-docker.sh`
Автоматизирует развертывание через Docker:
- Проверяет и устанавливает Docker
- Собирает образы
- Запускает контейнеры
- Проверяет статус

#### `deploy/deploy-pm2.sh`
Развертывание через PM2:
- Устанавливает Node.js и PM2
- Собирает приложение
- Настраивает автозапуск
- Создает логи

#### `deploy/deploy-systemd.sh`
Развертывание через systemd:
- Копирует файлы в `/var/www/trenki`
- Устанавливает systemd сервисы
- Настраивает автозапуск при загрузке

#### `deploy/update.sh`
Универсальный скрипт обновления:
- Автоматически определяет метод развертывания
- Обновляет код из Git
- Перезапускает сервисы

### Конфигурационные файлы

#### `ecosystem.config.js`
Конфигурация PM2:
- Настраивает два процесса (web + bot)
- Управляет логами
- Устанавливает лимиты памяти
- Автоматический перезапуск при сбоях

#### `next.config.ts`
Конфигурация Next.js:
- **Важно**: добавлен `output: 'standalone'` для Docker
- Настройки для remote images
- TypeScript конфигурация

#### `systemd/trenki-web.service`
Systemd сервис для веб-приложения:
- Запускает Next.js на порту 3000
- Автоперезапуск при сбоях
- Логирование в syslog
- Лимиты ресурсов

#### `systemd/trenki-bot.service`
Systemd сервис для бота:
- Запускает Telegram бота
- Зависит от веб-сервиса
- Автоперезапуск
- Лимиты ресурсов

#### `deploy/nginx.conf`
Конфигурация Nginx:
- Reverse proxy для Next.js
- SSL/TLS настройки
- Кэширование статики
- Сжатие gzip
- Rate limiting

### Документация

#### `DEPLOYMENT_GUIDE.md`
Полное руководство (400+ строк):
- Сравнение методов развертывания
- Пошаговые инструкции для каждого метода
- Настройка Nginx и SSL
- Настройка Telegram бота
- Мониторинг и логи
- Решение проблем

#### `DEPLOYMENT_QUICK_START.md`
Краткая шпаргалка:
- Быстрые команды для каждого метода
- Основные операции управления
- Минимальная настройка

#### `SECURITY_PRODUCTION.md`
Руководство по безопасности:
- Настройка firewall (UFW)
- Fail2ban защита
- SSH безопасность
- SSL/TLS
- Rate limiting
- Backup стратегия
- Чек-лист безопасности

#### `.env.example`
Шаблон переменных окружения:
- DATABASE_URL
- KINESCOPE_API_KEY
- BOT_TOKEN
- NEXT_PUBLIC_BOT_USERNAME
- NEXT_PUBLIC_APP_URL

## 🎯 Какой метод выбрать?

### 🐳 Docker - Рекомендуется для:
- Production серверов
- Легкого масштабирования
- Изоляции приложений
- CI/CD pipeline

**Плюсы**: Изоляция, легкое обновление, одинаковое окружение  
**Минусы**: Требует Docker, немного сложнее

### 📦 PM2 - Рекомендуется для:
- Быстрого развертывания
- VPS серверов
- Простого управления
- Мониторинга процессов

**Плюсы**: Простота, встроенный мониторинг  
**Минусы**: Нет изоляции

### ⚙️ systemd - Рекомендуется для:
- Интеграции с системой
- Серверов без Docker
- Централизованных логов
- Стандартного управления

**Плюсы**: Нативная интеграция, надежность  
**Минусы**: Привязка к Linux systemd

## 🚀 Быстрый старт

1. **Клонируйте проект**:
   ```bash
   git clone https://github.com/yourusername/trenki.git
   cd trenki
   ```

2. **Настройте .env**:
   ```bash
   cp .env.example .env
   nano .env
   ```

3. **Выберите метод и запустите**:
   ```bash
   # Docker
   ./deploy/deploy-docker.sh
   
   # PM2
   ./deploy/deploy-pm2.sh
   
   # systemd
   ./deploy/deploy-systemd.sh
   ```

4. **Настройте Nginx**:
   ```bash
   sudo cp deploy/nginx.conf /etc/nginx/sites-available/trenki
   sudo ln -s /etc/nginx/sites-available/trenki /etc/nginx/sites-enabled/
   # Отредактируйте домен
   sudo nano /etc/nginx/sites-available/trenki
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Получите SSL**:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

## 📊 Управление после развертывания

### Docker
```bash
docker compose ps                    # Статус
docker compose logs -f               # Логи
docker compose restart               # Перезапуск
docker compose down && docker compose up -d  # Полная перезагрузка
```

### PM2
```bash
pm2 status           # Статус
pm2 logs             # Логи
pm2 restart all      # Перезапуск
pm2 monit            # Мониторинг
```

### systemd
```bash
sudo systemctl status trenki-web             # Статус
sudo journalctl -u trenki-web -f             # Логи
sudo systemctl restart trenki-web            # Перезапуск
```

## 🔄 Обновление приложения

Используйте универсальный скрипт:
```bash
./deploy/update.sh
```

Он автоматически определит метод и выполнит обновление.

## 🔐 Безопасность

После развертывания обязательно:

1. ✅ Настройте firewall
2. ✅ Установите SSL
3. ✅ Настройте fail2ban
4. ✅ Ограничьте SSH доступ
5. ✅ Настройте backup

Подробнее: [SECURITY_PRODUCTION.md](SECURITY_PRODUCTION.md)

## 🐛 Проблемы?

1. Проверьте логи вашего метода развертывания
2. Убедитесь, что все переменные окружения заданы
3. Проверьте, что порты не заняты
4. Смотрите [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) для решения проблем

## 📞 Поддержка

Если нужна помощь, проверьте:
- Логи приложения
- Логи Nginx
- Системные логи
- GitHub Issues

---

**Готово!** Ваше приложение теперь готово к развертыванию на production сервере! 🎉
