/**
 * POST /api/webhook/github-deploy
 *
 * Принимает GitHub webhook на push в main и пишет «триггер-файл» в общую
 * директорию (`/tmp/deploy-trigger/trigger`, смонтированную с хоста в
 * docker-compose.production.yml). Контейнер сам себя не рестартит — это
 * делает host-cron, который раз в полминуты проверяет наличие файла и
 * запускает /home/trenki/deploy.sh, см. README ниже.
 *
 * Безопасность:
 *   - Подпись HMAC-SHA256 проверяется через GITHUB_WEBHOOK_SECRET.
 *     Без него endpoint вернёт 503 (не настроено).
 *   - Принимаем только push на refs/heads/main. ping → 200 для теста.
 *
 * Response:
 *   - 202 Accepted   — триггер записан, host подберёт
 *   - 200 OK         — pong (на ping-event GitHub'а)
 *   - 401 Unauthorized — подпись не совпала
 *   - 400 Bad Request  — нет нужных headers / не push
 *   - 503 Service Unavailable — GITHUB_WEBHOOK_SECRET не задан в env
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Куда писать триггер (в контейнере); хост маппит сюда свою папку.
const TRIGGER_DIR = '/tmp/deploy-trigger';
const TRIGGER_FILE = path.join(TRIGGER_DIR, 'trigger');

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'GITHUB_WEBHOOK_SECRET не задан в env' },
      { status: 503 },
    );
  }

  const event = request.headers.get('x-github-event');
  const signature = request.headers.get('x-hub-signature-256');

  // GitHub стучит ping'ом сразу после создания хука — отвечаем 200 без проверки.
  // (Подпись у ping тоже валидная, но для удобства отладки не привередничаем.)
  if (event === 'ping') {
    return NextResponse.json({ pong: true });
  }

  if (!signature || !signature.startsWith('sha256=')) {
    return NextResponse.json(
      { error: 'Нет X-Hub-Signature-256' },
      { status: 400 },
    );
  }

  const raw = await request.text();
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex');

  // timingSafeEqual чувствителен к длине — обе строки должны совпадать
  // побайтно, чтобы сравнение прошло.
  const sigHex = signature.slice('sha256='.length);
  const expHex = expected.slice('sha256='.length);
  if (!timingSafeEqualHex(sigHex, expHex)) {
    return NextResponse.json({ error: 'Подпись не совпала' }, { status: 401 });
  }

  if (event !== 'push') {
    return NextResponse.json({ ignored: `event=${event}` });
  }

  let payload: { ref?: string; head_commit?: { id?: string; message?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Невалидный JSON' }, { status: 400 });
  }

  if (payload.ref !== 'refs/heads/main') {
    return NextResponse.json({ ignored: `ref=${payload.ref}` });
  }

  // Пишем триггер с метой: коммит, заголовок, время. Host-cron подберёт.
  const triggerContent = JSON.stringify(
    {
      commit: payload.head_commit?.id ?? null,
      message: payload.head_commit?.message ?? null,
      receivedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  try {
    await fs.mkdir(TRIGGER_DIR, { recursive: true });
    await fs.writeFile(TRIGGER_FILE, triggerContent + '\n', 'utf8');
  } catch (err) {
    console.error('webhook: failed to write trigger', err);
    return NextResponse.json(
      { error: 'Не удалось записать триггер-файл (mount?)' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      commit: payload.head_commit?.id ?? null,
    },
    { status: 202 },
  );
}
