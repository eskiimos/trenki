# Треньки — тренировки для хоккеистов 🏒

PWA для персональных тренировок хоккеистов с видеоуроками, шортсами («треньки») и тренерским кабинетом.

## Функции

- Лента тренировок и тренеров
- Полноэкранный видеоплеер + TikTok-подобные шортсы со свайпом
- Pose-tracking атлета (MediaPipe) с воспроизведением скелета для тренера
- Профиль с характеристиками и историей прокачки
- Email-логин (OTP) через Resend
- Pwa: установка на домашний экран, офлайн-режим, push-уведомления
- Тренерский модуль: команды, задания, оценка pose-сессий

## Стек

- **Next.js 16** (App Router) + React 19, TypeScript, Tailwind 4
- **Prisma 6** + PostgreSQL (миграции вручную в `prisma/migrations/`)
- **jose** для подписи JWT-сессий (`SESSION_SECRET`)
- **Kinescope** для видео, **Cloudinary** для аватаров/обложек
- **Resend** для email
- **MediaPipe Tasks Vision** для pose-tracking
- **Vitest** для unit-тестов

Старые отчёты по миграциям и устаревшие гайды лежат в [`docs/archive/`](docs/archive/).

## 🧪 Тесты

```bash
npm test            # один прогон
npm run test:watch  # вотчер
npm run test:coverage
```

Unit-тесты лежат в `tests/lib/*.test.ts` и покрывают:
- алгоритм генерации тренировок (`training-algorithm-v3`) — матрицы целей, RPE, структура тренировки, возрастные модификаторы, ступени сложности;
- утилиты возраста (`age-utils`);
- подпись/верификацию JWT-сессии (`lib/session`);
- редактор PII в логгере (`lib/logger`).

Перед запуском в окружении должна быть переменная `SESSION_SECRET` (минимум 32 символа) — её можно сгенерировать `openssl rand -base64 48`.

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

4. Добавьте переменные в `.env.local` (см. полный список в `.env.example`):
```bash
DATABASE_URL=postgresql://user:pass@host:5432/trenki
SESSION_SECRET=$(openssl rand -base64 48)
RESEND_API_KEY=...           # без него OTP-код печатается в консоль
ADMIN_LOGIN=admin
ADMIN_PASSWORD=change_me
```

5. Примените миграции и сгенерируйте клиент:
```bash
npx prisma migrate deploy
npx prisma generate
```

6. Сгенерируйте PWA иконки:
```bash
npm run generate:icons
```

7. Запустите:
```bash
npm run dev
```

Приложение откроется на `http://localhost:3000`.

## 🔐 Авторизация

Вход — только через **email + одноразовый код** (`/login`):

- `POST /api/auth/email/send-code` высылает 6-значный код (Resend; в dev — в консоль).
- `POST /api/auth/email/verify-code` ставит httpOnly cookie `trenki_session` с подписанным JWT (`SESSION_SECRET`).
- `POST /api/auth/logout` сбрасывает сессию.

Middleware и API-роуты валидируют сессию через `requireAuthUser` (`src/lib/coach/guards.ts`) и `getSessionUserId` (`src/lib/auth-server.ts`). **Никаких userId из query/body не принимается.**

Подробности — в [`CLAUDE.md`](./CLAUDE.md) и [`SECURITY.md`](./SECURITY.md).

## 🌐 Деплой

Сейчас: Docker + nginx на reg.ru. Базовые конфиги — `Dockerfile`, `docker-compose.production.yml`, `nginx.conf`, `deploy.sh`. Перед релизом — `PRODUCTION_CHECKLIST.md` и `DEPLOYMENT_GUIDE.md`.

После деплоя обязательно: `npx prisma migrate deploy`.

## 📱 PWA

iOS (Safari): «Поделиться» → «На экран Домой». Android (Chrome): меню → «Установить приложение». Подробнее — [PWA.md](./PWA.md).

## 📄 Лицензия

MIT License
