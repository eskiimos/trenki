# Треньки — заметки для Claude

Короткая шпаргалка по проекту. Полная документация — в README.md и докер/деплой-файлах.

## Стек
- Next.js 16 (App Router) + React 19, TypeScript, Tailwind 4.
- Prisma 6 + PostgreSQL. Миграции вручную в `prisma/migrations/<timestamp>_<name>/migration.sql`.
- Vitest для unit-тестов (`tests/lib/`).
- Деплой: Docker + nginx на reg.ru. Конфиги — `Dockerfile`, `docker-compose.production.yml`, `nginx.conf`.

## Auth
- Источник истины — **httpOnly cookie `trenki_session`** с JWT (HS256, библиотека `jose`).
- Логин только через email OTP: `POST /api/auth/email/send-code` → `POST /api/auth/email/verify-code` → ставит cookie.
- Все API-роуты получают `userId` через `requireAuthUser(request)` (`src/lib/coach/guards.ts`) или `getSessionUserId(request)` (`src/lib/auth-server.ts`). **Никогда** не доверять `telegramId`/`userId` из query/body/header.
- Логаут: `POST /api/auth/logout`. На клиенте — `clearAuth()` из `src/lib/auth.ts`.
- Админ-сессии (login+password) живут в БД (`AdminSession` модель), token в cookie — raw hex, в БД — `sha256(token)`. Хелперы — `src/lib/admin-session.ts`.
- Telegram-вход полностью отключён, все старые эндпоинты возвращают 410. Не возрождать без явной просьбы.

## Security headers
- CSP с nonce собирается в `src/middleware.ts` (только в production). Inline-скрипты должны получать `nonce={nonce}` из `headers().get('x-nonce')`.
- Статичные headers (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) дублируются в `next.config.ts` и `nginx.conf`.

## Логи
- Использовать `logger` из `src/lib/logger.ts` (JSON, уровни, PII-редактор для email/telegramId/password/code/token).
- Уровень — переменная `LOG_LEVEL` (default `info` в проде).
- ESLint предупреждает на `console.log` (allow `warn`/`error`).

## Тесты
```bash
npm test
SESSION_SECRET=... npm test  # если ещё не в env
```
Покрывают чистые библиотеки. БД не подключается — для интеграционных тестов нужна отдельная инфраструктура.

## Pose-данные (MediaPipe): сессии атлетов и эталоны тренеров
- Запись кадров скелета — `PoseTracker.tsx` → `POST /api/pose-sessions`. Эталоны движений тренеров — `/admin/pose` (обработка в браузере админа, `src/components/admin/pose/`).
- Кадры — gzip-JSON в НАШЕМ S3 закрытым объектом (`pose/sessions/<id>.json.gz`, `pose/references/<videoId>.json.gz`, `src/lib/pose-storage.ts`). В БД — только `framesUrl` (`s3://…`) и сводка. Наружу кадры отдаёт только наш API после проверки доступа. До 22.09 кадры лежали в Cloudinary — перенос `/api/cron/pose-storage-migrate`.
- Доступ: атлет видит только свои сессии, тренер — только сессии атлетов своих команд со статусом ACTIVE (`src/lib/pose-access.ts` + `src/lib/coach/athlete-access.ts`); одной роли COACH недостаточно — это был IDOR. Оценку (PATCH) ставит только тренер команды атлета. На чтение `GET /api/pose-sessions/[id]` отдаёт ссылку на `/api/pose-sessions/[id]/frames` (та же проверка доступа, gzip из S3). Клиент распаковывает сам (`DecompressionStream('gzip')`).
- Совсем старые сессии лежат в `PoseSession.frames` (JSONB) — их тоже переносит `/api/cron/pose-storage-migrate`, до переноса работает legacy-ветка.
- Без `S3_*` env-переменных запись pose-сессий деградирует до старого JSONB-режима с warning'ом (эталоны — в `.pose-dev/`) — нормально для dev, в проде S3 должен быть настроен.

## Видео (S3 + серверная обработка)
- Новые видео и шортсы заливаются только файлом в наше S3 (`s3://uploads/…`), Kinescope для новых записей скрыт (решение владельца 16.09.2026). Старые Kinescope-записи читаются как раньше.
- При сохранении карточки создаётся `MediaJob`. Воркер `src/lib/media/worker.ts` (внутри процесса Next, будится из роутов и cron `check-workouts`) пережимает файл через ffmpeg и подменяет `videoUrl`. Правила сохранения карточки во время обработки — `src/lib/media/url-plan.ts` (покрыты тестами).
- Сырой исходник `s3://uploads/…` никогда не публикуется и не отдаётся атлетам. Не ставить `isPublished=true` строке с таким `videoUrl` в обход этих правил.

## Что НЕ делать без обсуждения
- Не возвращать Telegram-логин/виджет/QR (см. P0-ревью).
- Не возвращать чтение `telegramId`/`userId` из query/body — это IDOR.
- Не удалять deprecated-поля схемы (Profile.strength/endurance/... и Video.muscleGroupOld/*) без бэкфилла и тестов — там реальные данные пользователей.
- Не запускать `prisma migrate reset`/`prisma db push --accept-data-loss` на проде.
- Не возвращать pose-кадры в БД напрямую — только в S3 (решение владельца 22.09: pose-данные переехали из Cloudinary в S3).

## Что ещё в долгу (после P0+P1)
- Удалить deprecated-поля Profile/Video после бэкфилла.
- Разбить гигантские страницы (`video/[id]/page.tsx`, `admin/videos/page.tsx`).
- Интеграционные тесты на API (сейчас покрыты только чистые библиотеки).
- Снести `audience: ADAPTIVE` если он не используется или довести до ума.
