# Треньки - Тренировки для хоккеистов 🏒

Progressive Web App (PWA) для персональных тренировок хоккеистов с видео уроками, треньками и советами от профи.

## 🚀 Функции

- **Главная страница** с лентой тренировок и тренеров
- **Полноэкранный видеоплеер** для длинных видео  
- **TikTok/Shorts плеер** с swipe-навигацией (треньки)
- **Интерактивные превью** видео при наведении
- **Встроенный Telegram бот** через webhooks
- **Адаптивный дизайн** для мобильных устройств
- **👤 Профиль пользователя** с прогрессом и статистикой
- **📱 Онбординг** с email верификацией
- **📧 Email уведомления** через Resend
- **🔔 PWA функциональность**:
  - 📲 Установка на домашний экран
  - ⚡ Офлайн режим
  - 🚀 Быстрая загрузка (Service Worker)
  - 📬 Push-уведомления (готово к интеграции)

## 🛠️ Технологии

- **Next.js 15.5.2** с App Router
- **TypeScript** для типизации
- **Tailwind CSS** для стилей
- **Prisma** + **PostgreSQL** с Prisma Accelerate
- **Resend** для email уведомлений
- **Kinescope** для видео
- **PWA** (Service Worker, Web App Manifest)
- **Lucide React** для иконок
- **Google Fonts (Overpass)** для шрифтов
- **Telegram Bot API** через webhooks

## 📦 Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/eskiimos/trenki.git
cd trenki/telegram-workout-app
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл окружения:
```bash
cp .env.example .env.local
```

4. Добавьте переменные в `.env.local`:
```bash
BOT_TOKEN="your_bot_token_here"
WEB_APP_URL="https://your-domain.vercel.app"
DATABASE_URL="your_postgres_connection_string"
DIRECT_URL="your_postgres_direct_connection_string"
RESEND_API_KEY="your_resend_api_key"
```

5. Сгенерируйте Prisma Client и примените миграции:
```bash
npx prisma generate
npx prisma db push
```

6. Сгенерируйте PWA иконки:
```bash
npm run generate:icons
```

7. Запустите проект:
```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

## 🤖 Настройка Telegram бота

После развертывания на Vercel:

1. **Установите webhook:**
```bash
node webhook.js set
```

2. **Проверьте статус:**
```bash
node webhook.js info
```

3. **Удалите webhook (если нужно):**
```bash
node webhook.js delete
```

## 🌐 Развертывание на Vercel

1. Подключите GitHub репозиторий к Vercel
2. Настройте переменные окружения:
   - `BOT_TOKEN` - токен Telegram бота
   - `WEB_APP_URL` - URL вашего приложения
   - `DATABASE_URL` - PostgreSQL connection string (Prisma Accelerate)
   - `DIRECT_URL` - PostgreSQL direct connection string
   - `RESEND_API_KEY` - API ключ Resend для email
3. Разверните проект (иконки PWA генерируются автоматически)
4. Настройте webhook для бота

## 📱 PWA - Установка на устройство

### iOS (Safari)
1. Откройте сайт в Safari
2. Нажмите кнопку "Поделиться" (внизу)
3. Выберите "На экран Домой"
4. Нажмите "Добавить"

### Android (Chrome)
1. Откройте сайт в Chrome
2. Нажмите три точки (меню)
3. Выберите "Установить приложение"
4. Нажмите "Установить"

### Desktop (Chrome/Edge)
1. Откройте сайт в Chrome или Edge
2. Нажмите иконку установки в адресной строке
3. Нажмите "Установить"

Подробнее: [PWA.md](./PWA.md)

## 📱 Использование

- **Главная страница**: Просмотр ленты тренировок
- **Клик на видео**: Переход к полноэкранному плееру
- **Раздел "ТРЕНЬКИ"**: Короткие видео с hover-эффектами
- **Swipe**: Навигация между короткими видео
- **Telegram бот**: Автоматически работает через webhook

## 🎨 Дизайн

- Цветовая схема: `#303030` для основного текста
- Шрифт: Overpass для поддержки кириллицы
- Адаптивный дизайн для всех устройств

## 🔗 API Routes

- `/api/telegram` - Webhook для Telegram бота
- `/api/users/register` - Регистрация пользователя с email
- `/api/users/check` - Проверка существования пользователя
- `/api/user/status` - Статус профиля пользователя
- `/api/profile` - Получение и обновление профиля
- `/api/videos` - Получение списка видео
- `/api/shorts` - Получение коротких видео
- `/api/trainers` - Получение списка тренеров
- `/api/verify-email` - Отправка и проверка email кода
- `/api/send-email` - Отправка email уведомлений

## 🔐 Авторизация

### Вход через Telegram
Используется официальный Telegram Login Widget для безопасного входа:

- **Новый пользователь**: `/login` → Telegram → Заполнение профиля → Главная
- **Существующий**: `/login` → Telegram → Главная
- **С сохранённой сессией**: Автоматически (30 дней)
- **Выход**: Кнопка "Выйти" в профиле

📚 Подробнее:
- [TELEGRAM_LOGIN.md](./TELEGRAM_LOGIN.md) - Вход через Telegram
- [AUTH_QUICK_START.md](./AUTH_QUICK_START.md) - Быстрый старт
- [AUTH_SYSTEM.md](./AUTH_SYSTEM.md) - Техническая документация

## 📄 Лицензия

MIT License
