# Интеграция эквайринга T-Bank — план

Статус: **план, код не начат.** Документ-спецификация перед разработкой.

## Принятые решения (2026-06)

- **Фискализация:** облачная касса **T-Bank** — чеки 54-ФЗ формируются на их
  стороне. В запросе `Init` передаём объект `Receipt` (позиции, НДС, email/phone
  покупателя), T-Bank сам пробивает чек через свою кассу/ОФД.
- **Бизнес-модель (что продаём): НЕ решено** — это блокер Спринта 1. От неё
  зависит выбор: разовая оплата (`Init` → `Confirm`) или подписка (рекуррент
  `Init` с `Recurrent=Y` → сохранение `RebillId` → `Charge` по крону).
- **Старт:** сначала этот план; код по готовности бизнес-решения.

## Поток оплаты T-Bank (eacq)

1. Клиент жмёт «Оплатить» → наш бэкенд зовёт `POST securepay.tinkoff.ru/v2/Init`
   с `TerminalKey`, `Amount` (**в копейках, int**), `OrderId`, `Token` (подпись),
   опц. `Receipt`, `Recurrent=Y` (для подписки), `CustomerKey`.
2. T-Bank возвращает `PaymentId` + `PaymentURL` → редиректим клиента на оплату.
3. После оплаты T-Bank асинхронно шлёт **Notification** (POST) на наш
   `NotificationURL` (только HTTPS) со статусом и `Token`.
4. Мы **проверяем Token**, обновляем заказ, отвечаем телом **`OK`** (иначе
   T-Bank будет ретраить).
5. Параллельно клиент попадает на `SuccessURL`/`FailURL`; правда о статусе —
   из Notification + `GetState` (не доверять только редиректу).

### Подпись Token (важно!)
НЕ HMAC. Алгоритм: взять все корневые параметры запроса (кроме `Token`,
`Receipt`, `DATA`), добавить `Password`, отсортировать по ключу, **сконкатенировать
значения**, посчитать `SHA-256`. Та же схема для проверки входящих Notification.
Самая частая ошибка интеграции — покрыть unit-тестами (`tests/lib/`).

## Требования и текущая готовность

| Требование T-Bank | Статус в «Треньки» | Где |
|---|---|---|
| HTTPS для NotificationURL | ✅ есть | `nginx.conf`, Let's Encrypt, trenki.app |
| Вебхук с проверкой подписи | ⚙️ паттерн есть (HMAC) | [github-deploy](../src/app/api/webhook/github-deploy/route.ts) — обвязку берём, схему подписи пишем заново (SHA-256) |
| Исходящие вызовы к внешнему API с секретом | ✅ образец | `src/app/api/kinescope/upload-init/route.ts` |
| Секреты в env | ✅ паттерн | `${VAR}` в `docker-compose.production.yml` + `.env.production` |
| Крон (для рекуррента Charge) | ✅ образец | `src/app/api/cron/*` (Bearer) |
| Модель заказа/платежа в БД | ❌ нет | нужно |
| Поле tier/isPremium | ❌ нет | нужно |
| Клиент T-Bank (Init/Confirm/GetState/Charge + Token) | ❌ нет | нужно |
| Notification endpoint `/api/webhook/tbank` | ❌ нет | нужно |
| Receipt (54-ФЗ) | ❌ нет | через кассу T-Bank |
| Хранение RebillId + крон списаний | ❌ нет | нужно, если подписка |

## Естественные точки монетизации (найдено в коде)

- Лимиты `trainingsToday >= 2` ([training/complete](../src/app/api/training/complete/route.ts)) и
  `modulesToday >= 4` ([complete-module](../src/app/api/training/complete-module/route.ts)) — якоря для PREMIUM (снятие лимитов).
- Микроцикл / ИИ-тренер / тренерский модуль (COACH) — кандидаты в платные фичи.

## План по спринтам

- **Спринт 0 — продуктовое решение (блокер):** что именно продаём, цены, что даёт
  PREMIUM. Без этого Спринт 1 не начать.
- **Спринт 1 — модель БД (1 нед):** ручная миграция (`prisma/migrations/`,
  см. CLAUDE.md) — `Order`/`Payment` (OrderId, PaymentId, Amount копейки int,
  Status enum, jsonb для initParams/lastNotification) + `tier`/`isPremium` в Profile.
- **Спринт 2 — клиент T-Bank (1 нед):** модуль `src/lib/payments/tbank.ts`:
  генерация Token, методы Init/Confirm/Cancel/GetState (+Charge для рекуррента),
  timeout, env-секреты `TBANK_TERMINAL_KEY`/`TBANK_PASSWORD`. Unit-тесты подписи.
- **Спринт 3 — webhook (1 нед):** `/api/webhook/tbank` по образцу github-deploy:
  валидация Token, идемпотентность (по PaymentId+Status), ответ `OK`, маппинг
  статусов (AUTHORIZED/CONFIRMED/REJECTED/REFUNDED) → обновление Order + выдача доступа.
- **Спринт 4 — UI оплаты (1 нед):** экран апгрейда на лимитах, редирект на
  PaymentURL, страница ожидания с polling `GetState`.
- **Спринт 5 — Receipt + рекуррент (1–1.5 нед, если подписка):** Receipt в Init
  через кассу T-Bank; RebillId + крон Charge.
- **Спринт 6 — тестовый терминал → прод (0.5–1 нед):** прогон на тест-картах,
  переключение ключей.

**Оценка:** MVP разовой оплаты ~3–4 недели; подписка с фискализацией ~6–7 недель.

## Подводные камни

- `Amount` всегда в **копейках** (int), не в рублях.
- Не показывать «успех» сразу после Init/редиректа — только после Notification/GetState.
- Идемпотентность Notification: T-Bank может прислать один статус несколько раз.
- Двухстадийную оплату (Authorize→Confirm) НЕ брать без нужды — забытый Confirm
  теряет деньги. Для подписки — одностадийная (сразу CONFIRMED).
- `OrderId` уникальный, обычно числовой/строка; не переиспользовать.
