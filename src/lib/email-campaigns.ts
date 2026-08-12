/**
 * Триггерные email-кампании (не-транзакционные письма). Три письма воронки
 * «хоккей/мотивация»: WELCOME (после регистрации), FIRST_WORKOUT (после первой
 * полной тренировки), INACTIVITY (крон, простой ≥ 3 дней).
 *
 * Согласие: opt-out. Каждое письмо несёт ссылку «Отписаться» + заголовок
 * List-Unsubscribe. Отписка ставит User.emailOptOut = true.
 *
 * КИЛЛ-СВИТЧ: всё гейтится общим флагом settings.getEmailCampaignsEnabled()
 * (default FALSE). Пока флаг OFF — ни одно кампанийное письмо не уходит.
 *
 * Разделение проверок (два хелпера, чтобы крон не читал настройку на каждого):
 *  - canSendCampaign(user)     — async, ПОЛНАЯ проверка (флаг + email + optOut).
 *    Используют одноразовые вызовы (welcome/первая тренировка): они сами держат
 *    килл-свитч, даже если вызывающий забыл проверить флаг.
 *  - isCampaignRecipient(user) — sync, только email + optOut (без чтения флага).
 *    Используется в цикле крона неактивности: флаг там проверяется ОДИН раз
 *    сверху, а на каждого юзера читать настройку повторно не нужно.
 *
 * Дедуп-поля (welcomeEmailSentAt / firstWorkoutEmailSentAt / lastInactivityEmailAt)
 * ставит ВЫЗЫВАЮЩИЙ (роут/крон), НЕ функции отправки — так дедуп остаётся рядом
 * с атомарным «захватом» отправки и не двоится.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email';
import { getEmailCampaignsEnabled } from '@/lib/settings';
import { logger } from '@/lib/logger';

const APP_URL = 'https://trenki.app';
const BRAND = '#A1FF4A'; // бренд-лайм

/** Минимальная форма пользователя, нужная кампаниям. */
export interface CampaignUser {
  id: string;
  email: string | null;
  emailOptOut: boolean;
}

/** Экранирование HTML (тексты кампаний статичны, но экранируем на всякий случай). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Грубое приведение нашего контролируемого HTML тела к plain-text для text-версии. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Токен для ссылки «Отписаться»: hex HMAC-SHA256(userId, SESSION_SECRET).
 * Публичный роут отписки не требует auth, но валидирует этот токен — так один
 * юзер не сможет отписать другого, зная лишь его id.
 */
export function emailUnsubToken(userId: string): string {
  const secret = process.env.SESSION_SECRET || '';
  return createHmac('sha256', secret).update(userId).digest('hex');
}

/** Полная ссылка отписки для письма (и заголовка List-Unsubscribe). */
export function unsubscribeUrl(userId: string): string {
  const token = emailUnsubToken(userId);
  return `${APP_URL}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

/** Constant-time сверка токена отписки. false при несовпадении длины/значения. */
export function verifyUnsubToken(userId: string, token: string): boolean {
  const expected = emailUnsubToken(userId);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(token || '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface RenderCampaignEmailInput {
  title: string; // заголовок в теле письма (лайм-хедер)
  bodyHtml: string; // готовый HTML тела (обычно <p>…</p>)
  ctaText: string;
  ctaUrl: string;
  userId: string; // для ссылки отписки
}

/**
 * Общий тёмный layout письма-кампании: тёмный фон, бренд-лайм акцент/CTA,
 * в футере ссылка «Отписаться». Возвращает { html, text }.
 */
export function renderCampaignEmail(input: RenderCampaignEmailInput): {
  html: string;
  text: string;
} {
  const { title, bodyHtml, ctaText, ctaUrl, userId } = input;
  const unsub = unsubscribeUrl(userId);
  const safeTitle = escapeHtml(title);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0b0f1e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f1e; padding: 24px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #101530; border-radius: 12px; overflow: hidden; border: 1px solid #1f274a;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 32px 20px; text-align: center;">
              <h1 style="color: ${BRAND}; font-size: 30px; margin: 0; font-weight: bold; letter-spacing: 1px;">ТРЕНЬКИ</h1>
              <p style="color: #aeb6d6; font-size: 14px; margin: 8px 0 0 0;">Цифровой мир хоккея</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <h2 style="color: ${BRAND}; font-size: 22px; margin: 0 0 18px 0;">${safeTitle}</h2>
              <div style="color: #d6dbf0; font-size: 16px; line-height: 1.6;">
                ${bodyHtml}
              </div>

              <div style="text-align: center; margin: 30px 0 6px 0;">
                <a href="${ctaUrl}"
                   style="display: inline-block; background-color: ${BRAND}; color: #0b0f1e; text-decoration: none; padding: 14px 38px; border-radius: 8px; font-size: 17px; font-weight: bold;">
                  ${escapeHtml(ctaText)}
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0d1226; padding: 20px 30px; text-align: center; border-top: 1px solid #1f274a;">
              <p style="color: #8a93b8; font-size: 12px; margin: 0 0 6px 0;">
                Приложение Треньки — <a href="${APP_URL}" style="color: ${BRAND}; text-decoration: none;">trenki.app</a>
              </p>
              <p style="color: #6b7398; font-size: 12px; margin: 0;">
                Не хотите получать такие письма?
                <a href="${unsub}" style="color: #8a93b8; text-decoration: underline;">Отписаться</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    title,
    '',
    stripHtml(bodyHtml),
    '',
    `${ctaText}: ${ctaUrl}`,
    '',
    `Отписаться от писем Треньки: ${unsub}`,
    'Приложение Треньки — trenki.app',
  ].join('\n');

  return { html, text };
}

/** Получатель кампании: есть email и не отписан. НЕ читает флаг (sync). */
export function isCampaignRecipient(user: CampaignUser): boolean {
  return !!user.email && !user.emailOptOut;
}

/** Полная проверка права на отправку: килл-свитч + получатель. Async. */
export async function canSendCampaign(user: CampaignUser): Promise<boolean> {
  if (!isCampaignRecipient(user)) return false;
  return getEmailCampaignsEnabled();
}

/** Дословные тексты кампаний (воронка «хоккей/мотивация»). */
const CAMPAIGNS = {
  welcome: {
    subject: 'Добро пожаловать в Треньки! 🏒',
    body:
      'Привет! Ты в Треньках — тренируешься как в игре: занятия под твою цель и уровень ' +
      'энергии, XP за каждую тренировку, уровни и звания. Собери первую тренировку — это ' +
      'займёт пару минут.',
    ctaText: 'Собрать тренировку',
    ctaUrl: APP_URL,
  },
  firstWorkout: {
    subject: 'Первая тренировка позади — так держать! 💪',
    body:
      'Ты завершил первую тренировку и заработал первый XP. Дальше интереснее: три дня ' +
      'подряд включают «Ударный темп ×2», а за регулярность растут уровень и звание. ' +
      'Возвращайся завтра, чтобы не потерять темп.',
    ctaText: 'Продолжить',
    ctaUrl: APP_URL,
  },
  inactivity: {
    subject: 'Скучаем! Вернёшься на лёд? 🏒',
    body:
      'Ты не заходил в Треньки несколько дней. Твой прогресс ждёт — собери короткую ' +
      'тренировку под сегодняшнюю энергию, это быстро. Серия начинается с одного дня.',
    ctaText: 'Вернуться к тренировкам',
    ctaUrl: APP_URL,
  },
} as const;

type CampaignDef = (typeof CAMPAIGNS)[keyof typeof CAMPAIGNS];

/** Собирает и шлёт одно письмо кампании. Дедуп-поле НЕ трогает (ставит вызывающий). */
async function sendCampaign(user: CampaignUser, def: CampaignDef, label: string): Promise<boolean> {
  const bodyHtml = `<p style="margin: 0;">${escapeHtml(def.body)}</p>`;
  const { html, text } = renderCampaignEmail({
    title: def.subject,
    bodyHtml,
    ctaText: def.ctaText,
    ctaUrl: def.ctaUrl,
    userId: user.id,
  });
  const res = await sendEmail({
    to: user.email!,
    subject: def.subject,
    html,
    text,
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl(user.id)}>` },
  });
  if (!res.success) {
    logger.error('campaign email failed', { userId: user.id, campaign: label });
  }
  return res.success;
}

/**
 * WELCOME. Одноразовый вызов (роут логина) — сам держит килл-свитч через
 * canSendCampaign. Возвращает true, если письмо реально ушло.
 */
export async function sendWelcomeEmail(user: CampaignUser): Promise<boolean> {
  if (!(await canSendCampaign(user))) return false;
  return sendCampaign(user, CAMPAIGNS.welcome, 'welcome');
}

/**
 * FIRST_WORKOUT. Одноразовый вызов (роут завершения тренировки) — сам держит
 * килл-свитч через canSendCampaign.
 */
export async function sendFirstWorkoutEmail(user: CampaignUser): Promise<boolean> {
  if (!(await canSendCampaign(user))) return false;
  return sendCampaign(user, CAMPAIGNS.firstWorkout, 'first_workout');
}

/**
 * INACTIVITY. Вызывается ТОЛЬКО из крона, который уже проверил killswitch-флаг
 * один раз сверху — поэтому здесь проверяем лишь получателя (email + optOut),
 * без повторного чтения настройки на каждого в батче.
 */
export async function sendInactivityEmail(user: CampaignUser): Promise<boolean> {
  if (!isCampaignRecipient(user)) return false;
  return sendCampaign(user, CAMPAIGNS.inactivity, 'inactivity');
}
