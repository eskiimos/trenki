// Еженедельный email-дайджест родителю (role=PARENT) о прогрессе детей.
// Чистая сборка письма (subject/html/text) — БД не трогаем: данные собирает
// крон /api/cron/parent-digest (getGamificationSummary + getWeekActivity).
// Тесты — tests/lib/parent-digest.test.ts.

export interface DigestChild {
  name: string;
  statusTitle: string; // звание («Новичок», «Перспектива», ...)
  statusEmoji: string;
  level: number;
  streak: number; // дней подряд; блок в письме показываем только при ≥ 2
  weekWorkouts: number; // завершённых тренировок за 7 дней
  weekModules: number; // завершённых модулей за 7 дней
  potential: number | null; // средний показатель из Profile.potential
}

export interface ParentDigestInput {
  children: DigestChild[];
  weekLabel: string; // «1–7 августа» / «28 июля — 3 августа»
}

export interface ParentDigest {
  subject: string;
  html: string;
  text: string;
}

/** «1 тренировка / 2 тренировки / 5 тренировок» */
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** Имена детей — пользовательский ввод, в HTML только экранированными. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Подпись недели за последние 7 дней (Europe/Moscow): «1–7 августа», через
 * границу месяца — «28 июля — 3 августа».
 */
export function formatWeekLabel(now: Date = new Date()): string {
  const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const full = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Moscow',
  });
  const monthOf = new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'Europe/Moscow' });
  if (monthOf.format(start) === monthOf.format(now)) {
    const dayOf = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'Europe/Moscow' });
    return `${dayOf.format(start)}–${full.format(now)}`;
  }
  return `${full.format(start)} — ${full.format(now)}`;
}

function childBlockHtml(c: DigestChild): string {
  const name = escapeHtml(c.name);
  const workouts = `${c.weekWorkouts} ${plural(c.weekWorkouts, ['тренировка', 'тренировки', 'тренировок'])}`;
  const modules = `${c.weekModules} ${plural(c.weekModules, ['модуль', 'модуля', 'модулей'])}`;
  const streakBlock =
    c.streak >= 2
      ? `<p style="margin: 0 0 6px 0; color: #333333; font-size: 14px; line-height: 1.5;">
          🔥 Серия: <strong>${c.streak} ${plural(c.streak, ['день', 'дня', 'дней'])} подряд</strong>
        </p>`
      : '';
  const potential =
    c.potential != null ? String(Math.round(c.potential)) : '—';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9f4; border: 1px solid #e4ecdb; border-radius: 10px; margin: 0 0 14px 0;">
      <tr>
        <td style="padding: 16px 18px;">
          <h3 style="margin: 0 0 8px 0; color: #101530; font-size: 17px;">${name}</h3>
          <p style="margin: 0 0 6px 0; color: #333333; font-size: 14px; line-height: 1.5;">
            ${c.statusEmoji} Звание: <strong>${escapeHtml(c.statusTitle)}</strong> · Уровень ${c.level}
          </p>
          <p style="margin: 0 0 6px 0; color: #333333; font-size: 14px; line-height: 1.5;">
            За неделю: <strong>${workouts}</strong>, ${modules}
          </p>
          ${streakBlock}
          <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">
            Потенциал: <strong>${potential}</strong>
          </p>
        </td>
      </tr>
    </table>`;
}

function childBlockText(c: DigestChild): string {
  const lines = [
    `${c.name}`,
    `${c.statusEmoji} Звание: ${c.statusTitle} · Уровень ${c.level}`,
    `За неделю: ${c.weekWorkouts} ${plural(c.weekWorkouts, ['тренировка', 'тренировки', 'тренировок'])}, ${c.weekModules} ${plural(c.weekModules, ['модуль', 'модуля', 'модулей'])}`,
  ];
  if (c.streak >= 2) {
    lines.push(`Серия: ${c.streak} ${plural(c.streak, ['день', 'дня', 'дней'])} подряд`);
  }
  lines.push(`Потенциал: ${c.potential != null ? Math.round(c.potential) : '—'}`);
  return lines.join('\n');
}

/**
 * Собирает письмо-дайджест. Возвращает null, если у ВСЕХ детей пустая неделя
 * (0 тренировок и 0 модулей) — пустой отчёт не шлём, чтобы не спамить.
 */
export function buildParentDigest(input: ParentDigestInput): ParentDigest | null {
  const { children, weekLabel } = input;
  if (children.length === 0) return null;
  const hasActivity = children.some((c) => c.weekWorkouts > 0 || c.weekModules > 0);
  if (!hasActivity) return null;

  const names = children.map((c) => c.name).join(', ');
  const subject = `Итоги недели: ${names}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: #A1FF4A; font-size: 32px; margin: 0; font-weight: bold;">ТРЕНЬКИ</h1>
              <p style="color: #ffffff; font-size: 16px; margin: 8px 0 0 0;">Итоги недели · ${escapeHtml(weekLabel)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 28px 26px;">
              <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 18px 0;">
                Как прошла неделя ${children.length === 1 ? 'вашего хоккеиста' : 'ваших хоккеистов'} в «Треньках»:
              </p>
              ${children.map(childBlockHtml).join('')}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f8f8; padding: 18px 26px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                Приложение Треньки — <a href="https://trenki.app" style="color: #6b8f3c; text-decoration: none;">trenki.app</a>
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
    `Итоги недели (${weekLabel})`,
    '',
    children.map(childBlockText).join('\n\n'),
    '',
    'Приложение Треньки — trenki.app',
  ].join('\n');

  return { subject, html, text };
}
