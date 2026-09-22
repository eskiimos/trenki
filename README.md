# Треньки — тренировки для хоккеистов

PWA для персональных тренировок юных хоккеистов: ИИ-тренер собирает тренировку из видеомодулей под цель и состояние, недельные микроциклы, геймификация с XP и лигой, короткие ролики («треньки»), родительский и тренерский кабинеты, подписка через T-Bank. Прод — [trenki.app](https://trenki.app).

## Что умеет

**Атлет**
- Вход по email + одноразовый код. Онбординг: роль, профиль, самооценка характеристик.
- Быстрая тренировка: выбор цели и состояния → `generate-v3` собирает разминку, основную часть и заминку из видеомодулей под потенциал и возраст; замена и пропуск модуля, досрочный финиш.
- Микроцикл: недельный план Пн–Пт (стандарт / зарядка / овертайм / раскисление / лёгкая), автосборка по воскресеньям, обратная связь «изи / норм / тяжко» подстраивает следующую неделю, результат недели с приростом характеристик.
- Каталог видео с фильтрами, плеер с офлайн-скачиванием, лента и каталог шортсов, страницы тренеров с отзывами.
- Геймификация: XP, уровни и звания, серия дней и «Ударный темп ×2», ежедневный чекин, две группы наград (ачивки и древо навыков) с витриной в шапке профиля, недельная лига сверстников.
- Профиль: потенциал по пяти характеристикам, история тренировок и XP, избранное (треньки, занятия, тренировки ИИ), задания от тренера, настройки уведомлений.
- Подписка: пробный период, промокоды с персональной скидкой, оплата картой, продление заранее.
- PWA: установка на экран «Домой» (инструкция для iOS и Android), push-уведомления, офлайн-видео.

**Родитель** — кабинет `/parent`: привязка ребёнка по коду, его прогресс и лига, оплата подписки за ребёнка, еженедельный дайджест на почту.

**Тренер** — кабинет `/coach`: команда с кодом вступления и заявками, задания атлетам (видео или собранная тренировка), активность атлетов, просмотр pose-сессий.

**Админ** — `/admin`: видео, шортсы, тренеры, модули, теги, пользователи (премиум, тест-режим, накрутка прогресса), платежи и возвраты, paywall и цены, промокоды, отзывы и комментарии, push-рассылки, напоминания, статистика, проверка целостности контента, UI-кит.

## Стек

- **Next.js 16** (App Router, standalone), **React 19**, TypeScript strict, **Tailwind 4**.
- **Prisma 6** + PostgreSQL. Клиент генерируется в `src/generated/prisma`, миграции пишутся вручную в `prisma/migrations/<timestamp>_<name>/migration.sql`.
- **jose** — JWT сессий (HS256). **Resend** — письма. **web-push** — пуши.
- Хранилища: **S3 (reg.ru)** для видео и шортсов, **Cloudinary** для аватаров, обложек и pose-кадров, **Kinescope** — для старого контента.
- **MediaPipe Tasks Vision** (с CDN) — запись скелета в pose-сессиях.
- **T-Bank** интернет-эквайринг, чеки 54-ФЗ через облачную кассу банка.
- **Vitest** — unit-тесты, **ESLint 9** (flat config).
- Прод: Docker (node 20 alpine) + nginx на VPS, автодеплой из `main`.

## Быстрый старт

```bash
git clone https://github.com/eskiimos/trenki.git
cd trenki
npm install                 # postinstall делает prisma generate
cp .env.example .env.local  # заполнить, минимум DATABASE_URL и SESSION_SECRET
npx prisma migrate deploy
npm run dev                 # http://localhost:3000
```

В dev (`NODE_ENV` не `production`) письма не отправляются: код входа всегда приходит в ответе `send-code` полем `devCode`, `RESEND_API_KEY` не нужен, в логе код замаскирован. В проде ключ обязателен, без него сервер не стартует. Без `CLOUDINARY_*`, `S3_*`, `TBANK_*` соответствующие функции деградируют: pose-кадры пишутся в БД, загрузка видео и оплата недоступны, остальное работает.

Скрипты `package.json`:

| Команда | Что делает |
|---|---|
| `npm run dev` / `start` | Next.js |
| `npm run build` | `generate:icons`, затем `next build` |
| `npm test` / `test:watch` / `test:coverage` | Vitest (`tests/lib`) |
| `npm run lint` | ESLint |
| `npm run seed` | `prisma/seed.ts` |
| `npm run generate:icons` | PWA-иконки 192/512 из `public/icons/icon-app.svg`; нужен `sharp`, которого нет в зависимостях, без него пишет предупреждение и пропускает |

Перед пушем в `main` (это автодеплой на прод) прогоняйте вручную, CI этого не делает:

```bash
npm test && npm run lint && npx tsc --noEmit
```

## Переменные окружения

Шаблон — [`.env.example`](./.env.example). Источник истины по проду — секция `environment` в `docker-compose.production.yml`. Обязательные в проде проверяются при старте (`instrumentation.ts` → `src/lib/validate-env.ts`) и в `/api/health`.

| Группа | Переменные | Назначение |
|---|---|---|
| База | `DATABASE_URL` | PostgreSQL |
| Сессии | `SESSION_SECRET` (≥ 32 символов), `APP_ORIGIN` | подпись JWT; список разрешённых origin для CSRF-проверки, по умолчанию сверка с Host |
| Ссылки | `NEXT_PUBLIC_APP_URL` | базовый URL в письмах, `.ics`, приглашениях родителя и push-напоминаниях; по умолчанию `https://trenki.app` |
| Админка | `ADMIN_LOGIN`, `ADMIN_PASSWORD` | вход в `/admin/login` |
| Крон | `CRON_SECRET` | Bearer для `/api/cron/*` |
| Почта | `RESEND_API_KEY` | письма; в dev не нужен |
| Push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | web-push; ключи обязательны, subject по умолчанию указывает на старый домен, задавайте `mailto:admin@trenki.app` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | аватары, обложки, pose-кадры |
| S3 | `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | видео и шортсы; нужны все пять |
| Kinescope | `KINESCOPE_API_KEY` | чтение старого контента (ссылки, превью, длительность); новые видео и шортсы туда не заливаются, поле ссылки в админке — только у старых записей |
| Оплата | `TBANK_TERMINAL_KEY`, `TBANK_PASSWORD`, `TBANK_API_BASE` | боевая касса; `API_BASE` необязателен, по умолчанию `https://securepay.tinkoff.ru/v2` |
| Оплата, тест | `TBANK_TEST_TERMINAL_KEY`, `TBANK_TEST_PASSWORD`, `TBANK_TEST_API_BASE` | тестовый терминал, переключается в админке |
| Оплата | `TBANK_RETURN_ORIGIN` | origin для return- и notification-URL, по умолчанию `https://trenki.app` |
| Деплой | `GITHUB_WEBHOOK_SECRET` | подпись вебхука `/api/webhook/github-deploy` |
| Демо | `DEMO_BYPASS_EMAIL`, `DEMO_BYPASS_CODE` | витринные аккаунты без OTP; только для демо-данных |
| Логи | `LOG_LEVEL` | `debug` / `info` / `warn` / `error`, в проде по умолчанию `info` |
| Telegram | `BOT_TOKEN` | остаток старой интеграции, используется только для уведомлений через `src/lib/telegram.ts` |

Нюансы прода: `APP_ORIGIN` и `NEXT_PUBLIC_APP_URL` compose в контейнер не пробрасывает, там действуют значения по умолчанию. `KINESCOPE_API_KEY` в проде берётся из переменной `NEXT_PUBLIC_KINESCOPE_API_KEY` в `.env.production`.

## Архитектура

```
src/
  app/             страницы (App Router) и API-роуты (src/app/api/**/route.ts)
  app/admin/       админка
  components/      UI: кит в components/ui, админский кит в components/admin/ui.tsx
  hooks/           useSubscription, usePushNotifications, useTelegram (кэш профиля)
  lib/             чистая логика: gamification, achievements, league, microcycle,
                   training-algorithm-v3, payments/*, settings, logger, session
  middleware.ts    CSP с nonce, публичные маршруты, редиректы
prisma/            schema.prisma, migrations/, разовые tsx-скрипты
tests/lib/         unit-тесты чистых модулей
public/sw.js       service worker (офлайн-видео, push)
instrumentation.ts проверка обязательных env при старте
```

### Авторизация

- Источник истины — httpOnly cookie `trenki_session` с JWT. Вход только по email: `POST /api/auth/email/send-code` → `POST /api/auth/email/verify-code`. Выход `POST /api/auth/logout`. Есть мультиаккаунт на одном устройстве (`/api/auth/accounts`, `switch`).
- Все API-роуты получают пользователя через `requireAuthUser` (`src/lib/coach/guards.ts`) или `getSessionUserId` (`src/lib/auth-server.ts`). Роли: `requireCoach`, `requireAthlete`; подписка: `requireActiveSubscription` (402) и `gatePaidContent`. **`userId`/`telegramId` из query или body не принимаются.**
- Middleware не защищает `/api/*`, каждый роут вызывает гвард сам. Мутирующие auth-роуты дополнительно проверяют `Origin` (`src/lib/same-origin.ts`).
- Админка: `/admin/login` по `ADMIN_LOGIN`/`ADMIN_PASSWORD`, сессия в таблице `AdminSession` (в cookie сырой токен, в БД sha256). `requireAdminAsync` пропускает и такую сессию, и обычного пользователя с `User.isAdmin`.
- Telegram-вход отключён, старые эндпоинты отвечают 410.

### Безопасность и логи

- CSP с nonce собирается в `src/middleware.ts` только в production; inline-скрипты берут nonce из заголовка `x-nonce`. Внешние хосты (Cloudinary, Kinescope, CDN MediaPipe, Метрика) захардкожены в `buildCsp`, origin S3 берётся из `S3_ENDPOINT`.
- Статичные заголовки (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) дублируются в `next.config.ts` и `nginx.conf`.
- Логи — `logger` из `src/lib/logger.ts`: JSON, уровни, редактор PII (пароли, токены, коды; email и телефон хэшируются). `console.log` даёт warning в ESLint.
- Rate limit — in-memory (`src/lib/coach/rate-limit.ts`): OTP, создание платежа, генерация тренировок (10 в сутки), вступление в команду. Сбрасывается при рестарте.

### Тренировки

- Быстрая: `/training/assessment` → `POST /api/training/generate-v3` → `/training/workout`. Алгоритм в `src/lib/training-algorithm-v3.ts`: матрицы целей и типов нагрузки, ступени сложности по потенциалу, RPE, возрастные модификаторы. Завершение начисляет прирост характеристик (`CharacteristicHistory`).
- Микроцикл: `src/lib/microcycle/*`. Неделя из 5 дней с намерением (`MicrocycleIntent`), цель дня восстанавливается из намерения и номера цикла, быстрая тренировка может закрыть день цикла. Автосборка — крон по воскресеньям для профилей с `autoGenerateMicrocycle`.
- Pose-сессии: `PoseTracker` пишет кадры скелета (3 fps, до 2 минут) → `POST /api/pose-sessions` → gzip-JSON в Cloudinary (`framesUrl`), тренер смотрит через signed URL на час. В атлетском плеере кнопка камеры сейчас скрыта, у тренера просмотр работает.

### Геймификация

Ничего не хранится в БД, всё считается из истории `WorkoutSession` и `DailyCheckin` (`src/lib/gamification.ts`, `gamification-server.ts`). Изменение констант меняет уровни всех пользователей задним числом.

- Тренировка `COMPLETED` с хотя бы одним модулем — 100 XP, каждый модуль — 20 XP. `PARTIAL` (досрочный финиш) даёт модули и день серии, но не бонус.
- «Ударный темп ×2»: с третьего дня подряд XP дня удваивается. Серия жива, если тренировка была сегодня или вчера. День считается по таймзоне пользователя.
- Чекин: 10 XP с понедельника по среду, 20 в четверг и пятницу, 50 в субботу и воскресенье, день по таймзоне пользователя. Серию не продлевает и темпом не умножается.
- Переход с уровня N на следующий стоит `100 + (N−1)·60` XP: 100, потом 160, 220 и так далее. Звания: Новичок, Перспектива (5), Юниор (12), Про (22), Звезда (35), Легенда (50).
- Награды: «Ачивки» (`streak-achievements.ts`: вехи 1/30/67/100 тренировок, серии 3/5/7/14, «Ранняя пташка», «Воин выходных») и «Достижения» (`achievements.ts`: 7 целей × две эволюции за 5 и 10 тренировок с целью). Тиры: серые, серебро, золото, «67» фиолетовая. До 5 наград в шапке профиля (`User.pinnedAchievements`).
- Лига (`league.ts`, `league-server.ts`): когорта по году рождения, недельный XP по московской неделе, чужие участники обезличены.

### Подписка и платежи

- Режим paywall в `AppSetting` `paywall.mode`: `off` (гейтов нет), `admins` (обкатка на админах), `on`. Премиум-пользователь проходит везде. Урок недели открыт всем.
- Доступ: `User.accessTier` + `premiumUntil` (`null` при PREMIUM — бессрочно), проверка только через `hasPremium` (`src/lib/access.ts`).
- Цены в `AppSetting` (`subscription.*`): базовая цена, интро-скидка на первые N оплат; промокоды `ReferralCode` с собственными скидкой и числом оплат (`NULL` наследует глобальные, `0` отключает скидку) и триалом в днях. Персональная цена считается в одном месте, `resolveUserPricing`, и для показа, и для списания.
- Пробный период `trial.days` выдаётся при регистрации; с промокодом берётся больший из двух, они не складываются.
- Поток оплаты: `POST /api/payments/init` → T-Bank Init → редирект на форму банка → нотификация в `POST /api/webhook/tbank` (подпись Token, касса по TerminalKey и обязана совпадать с кассой платежа) и подстраховка `GET /api/payments/status` → идемпотентная выдача 30 дней (`grantPremiumForPayment`, стекуется поверх активного срока). Автосписаний нет, продление — новой оплатой. Родитель может платить за ребёнка (`childId`), чек уходит плательщику.
- Две кассы: `payments.mode` = `live` | `test`, секреты только в env (`TBANK_*` и `TBANK_TEST_*`). Тестовые платежи помечаются `Payment.isTest` и не считаются оплатой ни для скидок, ни для бейджей в админке.
- Чеки 54-ФЗ: объект `Receipt` в Init и Cancel, флаг отдельно на каждую кассу (`receipt.enabled`, `receipt.enabled.test`), СНО и НДС общие. Включать на боевой кассе только после подключения облачной кассы в банке.
- Возвраты: `/admin/payments` → Cancel через банк (полная сумма, чек возврата плательщику) → откат одного периода премиума (`revokePremiumForPayment`). Возврат из кабинета банка приходит нотификацией и откатывает так же. Выдача и откат идемпотентны по заказу и заморожены после возврата.
- Статус в админке: «Премиум» только при реальной оплате (`premiumGrantedAt` без возврата и не тест), иначе «Пробный период» или «Премиум (вручную)»; истёкшие помечены, бывшие плательщики без подписки — «Платил раньше».

### Хранилища

| Что | Где | Как отдаётся |
|---|---|---|
| Видео каталога | S3, приватно, `Video.videoUrl = s3://…` | presigned URL на 6 часов, только из гейтированных роутов |
| Шортсы | S3, публично | прямая ссылка |
| Обложки | Cloudinary (`/api/upload`, `kind=short` → 9:16) или S3 | прямая ссылка |
| Аватары, логотипы клубов | Cloudinary | прямая ссылка |
| Pose-кадры | Cloudinary raw, authenticated | signed URL на час |
| Старый контент | Kinescope | через `/api/kinescope/metadata`; новое туда не заливается |

Обработка видео: админ заливает любой файл с телефона или камеры (mov/mp4/m4v/webm до 4 ГБ) в `s3://uploads/…`. При сохранении карточки видео или шортса создаётся задача `MediaJob`. Воркер (`src/lib/media/worker.ts`) крутится внутри процесса Next, по одной задаче:
1. скачивает файл и смотрит его через `ffprobe`;
2. готовый H.264 до 1080p с нормальным битрейтом только перекладывает в mp4 с faststart, остальное пережимает `ffmpeg` (`nice 19`) в H.264 1080p ~4 Мбит/с + AAC;
3. кладёт результат в `videos/` (приватно) или `shorts/` (публично), делает обложку, если её нет, и подменяет `videoUrl` и длительность.

- **До конца обработки** новая карточка не опубликована. У готового видео при замене файла до подмены играет старый файл, а сам старый файл удаляется через 7 часов.
- **Деплой прерывает обработку:** следующий процесс подхватывает задачу заново, этот перезапуск не тратит попытку.
- **Брошенные заливки** (файл залит, карточка не сохранена) удаляются через 2 суток.
- **ffmpeg** ставится в образ (`Dockerfile`). В dev без `ffmpeg`/`ffprobe` в PATH задачи просто стоят в очереди.

## Крон-задачи

Роуты `GET /api/cron/*` с заголовком `Authorization: Bearer $CRON_SECRET`. Расписание живёт в crontab на хосте и дёргает `localhost:3000` напрямую, минуя nginx. Повторный вызов безопасен: напоминания и рассылки дедупятся полями на `User`, напоминания о запланированных тренировках флагами на `ScheduledWorkout`, автосборка цикла проверяет, что цикл на неделю ещё не создан.

| Роут | Когда | Что |
|---|---|---|
| `check-workouts` | каждую минуту | напоминания о запланированных тренировках; заодно будит воркер обработки видео |
| `microcycle-reminders` | каждую минуту | напоминания по дням цикла; заодно вечерние вовлекающие пуши (серия, пропуск 2 дня, новичкам, «запылились») по местному времени игрока — время в `/admin/reminders` |
| `subscription-expiry` | раз в час или в день | пуш «подписка скоро закончится» за 3 дня; молчит при paywall `off` |
| `engagement-nudges` | ежедневно (устарело) | то же, что вечерние пуши из `microcycle-reminders`; оставлен для старой строки crontab и ручного запуска |
| `inactivity-email` | ежедневно | письмо неактивным; за рубильником `emailCampaigns.enabled` |
| `microcycle-autogenerate` | воскресенье | сборка микроцикла на неделю |
| `parent-digest` | воскресенье 18:00 | дайджест родителям |

Тексты пушей по сценариям редактируются в `/admin/push-texts` (хранятся в `app_settings.push.templates`, стандартные — `src/lib/notifications/templates.ts`).

## Деплой

Прод: VPS reg.ru, `/home/trenki`, Docker Compose (`docker-compose.production.yml`): сервис `migrate` выполняет `prisma migrate deploy`, затем стартует `app` (healthcheck `/api/health`), перед ним `nginx` с сертификатом Let's Encrypt (продление через webroot).

**Push в `main` = деплой на прод.** Реально работает поллинг на хосте: cron root раз в две минуты запускает `/home/trenki/auto-deploy.sh` (в репозитории его нет), и если `origin/main` ушёл вперёд, делает `git pull` и `docker-compose up -d --build app` под `flock /tmp/trenki-deploy.lock`. Два дубля того же сценария: `.github/workflows/deploy.yml` по SSH и схема «GitHub-вебхук → триггер-файл → `scripts/deploy/deploy-watch.sh`», все под тем же замком. Сборка занимает 2–8 минут; хост может уже показывать новый коммит, пока контейнер ещё старый. Надёжная проверка — новый роут или строка в `/app/.next` внутри контейнера, либо запись в `_prisma_migrations`.

Ручной перезапуск с новыми переменными окружения, не мешая автодеплою:

```bash
cd /home/trenki && flock -w 600 /tmp/trenki-deploy.lock \
  docker-compose -f docker-compose.production.yml --env-file .env.production up -d app
```

Особенности образа: `NODE_OPTIONS=--use-openssl-ca` и российские корневые сертификаты из `certs/`, без них запросы к T-Bank падают. Контейнер живёт в `TZ=Europe/Moscow`.

Не запускать на проде `prisma migrate reset` и `prisma db push --accept-data-loss`. Скрипты `prisma/clear-users.ts` и `prisma/delete-videos.ts` деструктивны.

## Тесты

```bash
npm test
```

33 файла, 410 тестов, без базы данных. Покрыты чистые модули `src/lib`: алгоритм тренировок, микроцикл, геймификация и награды, лига, платежи (подпись T-Bank, чек, цены, выдача и откат премиума, статус подписки), сессии и мультиаккаунт, логгер, валидация профиля. API-роуты, транзакции Prisma и компоненты не тестируются.

`SESSION_SECRET` в окружении задавать не нужно, тесты ставят свой; если задать короче 32 символов, упадут тесты мультиаккаунта.

## Документация

Актуально: этот README, [`CLAUDE.md`](./CLAUDE.md) (правила проекта и список того, что нельзя делать без обсуждения), [`scripts/deploy/README.md`](./scripts/deploy/README.md).

Устарело и описывает прежние варианты (Vercel, Telegram-вход, Prisma Accelerate, PM2): `SECURITY.md`, `DEPLOYMENT_GUIDE.md`, `PRODUCTION_CHECKLIST.md`, `TECH_STACK.md`, `PWA.md`, `CHANGELOG.md`, `docs/tbank-integration.md` (план, оплата с тех пор реализована). Архив в `docs/archive/`. Легаси-конфиги `docker-compose.yml`, `Dockerfile.bot`, `ecosystem.config.js`, `systemd/`, `deploy/` прод-стеком не используются.

## Лицензия

MIT License
