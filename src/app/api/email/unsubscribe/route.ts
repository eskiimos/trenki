/**
 * GET /api/email/unsubscribe?u=<userId>&t=<token>
 *
 * Публичный роут отписки (БЕЗ auth — ссылка приходит в письме, у получателя нет
 * сессии). Гейт — токен: t должен совпасть с HMAC-SHA256(userId, SESSION_SECRET)
 * (constant-time). Валидный токен → User.emailOptOut = true. Неверный/пустой
 * токен → 400, никаких действий. Это защищает от отписки чужого юзера по его id.
 *
 * Транзакционные письма (OTP-логин, отвязка родителя) emailOptOut НЕ подчиняются —
 * отписка глушит только не-транзакционные кампании.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubToken } from '@/lib/email-campaigns';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const BRAND = '#A1FF4A';

function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Треньки</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0b0f1e; color: #d6dbf0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="min-height: 100vh; background-color: #0b0f1e;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color: #101530; border: 1px solid #1f274a; border-radius: 12px;">
          <tr>
            <td style="padding: 36px 30px; text-align: center;">
              <h1 style="color: ${BRAND}; font-size: 26px; margin: 0 0 16px 0;">ТРЕНЬКИ</h1>
              <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;">${title}</h2>
              <p style="color: #aeb6d6; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">${message}</p>
              <a href="https://trenki.app"
                 style="display: inline-block; background-color: ${BRAND}; color: #0b0f1e; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: bold;">
                Открыть Треньки
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const htmlResponse = (status: number, body: string) =>
  new NextResponse(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = (searchParams.get('u') || '').trim();
  const token = (searchParams.get('t') || '').trim();

  if (!userId || !token || !verifyUnsubToken(userId, token)) {
    return htmlResponse(
      400,
      page('Ссылка недействительна', 'Ссылка для отписки неверна или устарела. Ничего не изменилось.'),
    );
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { emailOptOut: true } });
    logger.info('email unsubscribe', { userId });
  } catch (e) {
    // Токен валиден только для существующего id (HMAC на id), но на всякий случай
    // ловим отсутствие записи (P2025) и т.п. — отдаём мягкую ошибку.
    logger.error('email unsubscribe failed', { userId, err: String(e) });
    return htmlResponse(
      400,
      page('Не получилось', 'Не удалось отписать вас от писем. Попробуйте позже.'),
    );
  }

  return htmlResponse(
    200,
    page(
      'Вы отписались',
      'Вы отписались от писем Треньки. Мы больше не будем присылать вам напоминания и подборки. Транзакционные письма (код входа) продолжат приходить.',
    ),
  );
}
