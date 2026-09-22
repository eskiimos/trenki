// Еженедельный email-дайджест родителю (role=PARENT) о прогрессе детей.
// Чистая сборка письма (subject/html/text) — БД не трогаем: данные собирает
// крон /api/cron/parent-digest (getGamificationSummary + getWeekActivity).
// Тесты — tests/lib/parent-digest.test.ts.

export interface DigestGains {
  power: number;
  speed: number;
  endurance: number;
  technique: number;
  flexibility: number;
  potential: number;
}

export interface DigestTask {
  goalLabel: string; // «Мощный бросок»
  done: number;
  target: number;
  completed: boolean;
  /** Активное, но срок вышел */
  expired?: boolean;
}

export interface DigestChild {
  name: string;
  statusTitle: string; // звание («Новичок», «Перспектива», ...)
  statusEmoji: string;
  level: number;
  streak: number; // дней подряд; блок в письме показываем только при ≥ 2
  weekWorkouts: number; // тренировок за 7 дней (завершённые и досрочно завершённые)
  weekModules: number; // завершённых модулей за 7 дней
  potential: number | null; // средний показатель из Profile.potential
  /** Прирост характеристик за 7 дней (п.9а «Середина сентября»). */
  gains?: DigestGains;
  /** Задания от родителей: активные и выполненные за неделю. */
  tasks?: DigestTask[];
}

export interface ParentDigestInput {
  children: DigestChild[];
  weekLabel: string; // «1–7 августа» / «28 июля — 3 августа»
  /** Ссылка отписки (обязательна для регулярной рассылки) */
  unsubscribeUrl?: string;
}

const GAIN_LABELS: Array<[keyof Omit<DigestGains, 'potential'>, string]> = [
  ['power', 'Сила'],
  ['speed', 'Скорость'],
  ['endurance', 'Выносливость'],
  ['technique', 'Техника'],
  ['flexibility', 'Гибкость'],
];

/** «+1,2» — прирост с одним знаком после запятой; 0 и шум не показываем. */
function formatGain(v: number): string | null {
  const rounded = Math.round(v * 10) / 10;
  if (rounded <= 0) return null;
  return `+${rounded.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}`;
}

/** «Сила +1,2 · Скорость +0,8» или null, если роста не было. */
export function gainsLine(gains: DigestGains | undefined): string | null {
  if (!gains) return null;
  const parts = GAIN_LABELS.map(([key, label]) => {
    const g = formatGain(gains[key]);
    return g ? `${label} ${g}` : null;
  }).filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function taskLine(t: DigestTask): string {
  return t.completed
    ? `«${t.goalLabel}» — выполнено (${t.target} из ${t.target})`
    : `«${t.goalLabel}» — ${Math.min(t.done, t.target)} из ${t.target}${t.expired ? ', срок вышел' : ''}`;
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
  const potentialGain = c.gains ? formatGain(c.gains.potential) : null;
  const potential =
    (c.potential != null ? String(Math.round(c.potential)) : '—') + (potentialGain ? ` (${potentialGain} за неделю)` : '');
  const growth = gainsLine(c.gains);
  const growthBlock = growth
    ? `<p style="margin: 0 0 6px 0; color: #333333; font-size: 14px; line-height: 1.5;">
          📈 Рост: <strong>${escapeHtml(growth)}</strong>
        </p>`
    : '';
  const tasksBlock = c.tasks?.length
    ? `<p style="margin: 6px 0 0 0; color: #333333; font-size: 14px; line-height: 1.5;">
          📋 Задания: ${c.tasks.map((t) => escapeHtml(taskLine(t))).join('; ')}
        </p>`
    : '';
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
          ${growthBlock}
          <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">
            Потенциал: <strong>${potential}</strong>
          </p>
          ${tasksBlock}
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
  const growth = gainsLine(c.gains);
  if (growth) lines.push(`Рост: ${growth}`);
  const potentialGain = c.gains ? formatGain(c.gains.potential) : null;
  lines.push(
    `Потенциал: ${c.potential != null ? Math.round(c.potential) : '—'}` +
      (potentialGain ? ` (${potentialGain} за неделю)` : ''),
  );
  if (c.tasks?.length) lines.push(`Задания: ${c.tasks.map(taskLine).join('; ')}`);
  return lines.join('\n');
}

/**
 * Собирает письмо-дайджест. Возвращает null, если у ВСЕХ детей пустая неделя
 * (0 тренировок и 0 модулей) — пустой отчёт не шлём, чтобы не спамить.
 */
export function buildParentDigest(input: ParentDigestInput): ParentDigest | null {
  const { children, weekLabel, unsubscribeUrl } = input;
  if (children.length === 0) return null;
  const hasActivity = children.some(
    (c) => c.weekWorkouts > 0 || c.weekModules > 0 || (c.tasks ?? []).some((t) => t.completed || t.done > 0),
  );
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
              ${unsubscribeUrl ? `<p style="color: #999999; font-size: 12px; margin: 8px 0 0 0;">Не хотите получать отчёты? <a href="${escapeHtml(unsubscribeUrl)}" style="color: #999999;">Отписаться</a></p>` : ''}
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
    ...(unsubscribeUrl ? ['', `Отписаться: ${unsubscribeUrl}`] : []),
  ].join('\n');

  return { subject, html, text };
}
