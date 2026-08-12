import { Resend } from 'resend';
import { logger } from '@/lib/logger';

// Ленивая инициализация Resend
let resendInstance: Resend | null = null;

function getResend() {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  /** Plain-text версия письма (антиспам + доступность). */
  text?: string;
  /** Доп. заголовки письма (напр. List-Unsubscribe для кампаний). */
  headers?: Record<string, string>;
}

/**
 * Отправка email через Resend
 */
export async function sendEmail({ to, subject, html, from, text, headers }: SendEmailOptions) {
  try {
    const resend = getResend();
    const result = await resend.emails.send({
      from: from || 'Треньки <noreply@trenki.app>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      headers,
    });

    logger.info('email sent', { id: result.data?.id ?? null });
    return { success: true, data: result };
  } catch (error) {
    logger.error('email send failed', error);
    return { success: false, error };
  }
}

/**
 * Шаблон: Приветственное письмо
 */
export function getWelcomeEmailTemplate(name: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Добро пожаловать в Треньки!</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #A1FF4A; font-size: 48px; margin: 0; font-weight: bold;">ТРЕНЬКИ</h1>
              <p style="color: #ffffff; font-size: 18px; margin: 10px 0 0 0;">Цифровой мир хоккея</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #101530; font-size: 24px; margin: 0 0 20px 0;">
                Привет, ${name}! 👋
              </h2>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Добро пожаловать в <strong>Треньки</strong> — твой цифровой помощник в мире хоккея! 🏒
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
                Теперь ты можешь:
              </p>
              
              <ul style="color: #333333; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                <li>Смотреть короткие видео тренировок</li>
                <li>Изучать технику от профессионалов</li>
                <li>Отслеживать свой прогресс</li>
                <li>Находить единомышленников</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://trenki.vercel.app" 
                   style="display: inline-block; background-color: #A1FF4A; color: #000000; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                  Начать тренировки 🚀
                </a>
              </div>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Удачных тренировок! 💪<br>
                Команда Треньки
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © 2025 Треньки. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Шаблон: Уведомление о новом видео
 */
export function getNewVideoEmailTemplate(videoTitle: string, videoUrl: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Новое видео в Треньки!</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #A1FF4A; font-size: 32px; margin: 0;">🎥 Новое видео!</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #101530; font-size: 22px; margin: 0 0 20px 0;">
                ${videoTitle}
              </h2>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Для тебя доступно новое обучающее видео! Не пропусти возможность улучшить свою технику.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${videoUrl}" 
                   style="display: inline-block; background-color: #A1FF4A; color: #000000; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                  Смотреть видео 🎬
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © 2025 Треньки. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/** Экранирование HTML для пользовательских строк в письмах (имя ребёнка и т.п.). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Шаблон: ребёнок просит отвязать родителя. Родитель подтверждает или
 * отклоняет запрос в своём кабинете trenki.app/parent.
 */
export function getUnlinkRequestEmailTemplate(childName: string) {
  const name = escapeHtml(childName);
  const cabinetUrl = `${(process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://trenki.app').replace(/\/$/, '')}/parent`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Запрос на отвязку в Треньках</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #A1FF4A; font-size: 28px; margin: 0;">Запрос на отвязку</h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                <strong>${name}</strong> просит отвязать вас от своего профиля в Треньках.
                Пока вы не подтвердите запрос, связь сохраняется и вы продолжаете видеть прогресс ребёнка.
              </p>

              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Подтвердите отвязку или отклоните запрос в своём родительском кабинете.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${cabinetUrl}"
                   style="display: inline-block; background-color: #A1FF4A; color: #000000; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 18px; font-weight: bold;">
                  Открыть кабинет
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8f8f8; padding: 20px 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © 2025 Треньки. Все права защищены.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
