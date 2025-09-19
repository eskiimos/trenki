# Trenki - Workout Social Network

Социальная сеть для тренировок с функционалом коротких видео как TikTok/YouTube Shorts и встроенным Telegram ботом.

## 🚀 Функции

- **Главная страница** с лентой тренировок и тренеров
- **Полноэкранный видеоплеер** для длинных видео  
- **TikTok/Shorts плеер** с swipe-навигацией
- **Интерактивные превью** видео при наведении
- **4 коротких видео** с плавными переходами
- **Встроенный Telegram бот** через webhooks
- **Адаптивный дизайн** для мобильных устройств

## 🛠️ Технологии

- **Next.js 15.5.2** с App Router
- **TypeScript** для типизации
- **Tailwind CSS** для стилей
- **Prisma** для работы с базой данных
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
```

5. Запустите проект:
```bash
npm run dev
```

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
3. Разверните проект
4. Настройте webhook для бота

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

## 📄 Лицензия

MIT License
