// Тексты пушей, которые админ редактирует сам (решение владельца 21.09, п.11:
// «сценарии определите сами, а что попадёт в текст — расписывать в админке»).
// Здесь — реестр сценариев, стандартные тексты, подстановка переменных и
// проверка того, что ввёл админ. Чистая логика без БД; хранение —
// ./templates-server.ts, тесты — tests/lib/push-templates.test.ts.
//
// Переменные пишутся в фигурных скобках: «Привет, {name}!». Эмодзи в пушах
// допустимы: это системное уведомление, а не экран приложения.

export type PushTemplateKey =
  | 'onboarding1'
  | 'onboarding2'
  | 'onboarding3'
  | 'streak'
  | 'streakTempo'
  | 'missed'
  | 'dusty'
  | 'dailyReminder1'
  | 'dailyReminder2'
  | 'assignmentNew'
  | 'parentTaskNew'
  | 'microcycleReady'
  | 'subscriptionExpiry';

export interface PushText {
  title: string;
  body: string;
}

export type PushTemplateGroup = 'engagement' | 'cycle' | 'tasks' | 'subscription';

export interface PushTemplateVar {
  key: string;
  /** Что подставится — для подсказки в админке. */
  hint: string;
  /** Пример для предпросмотра. */
  sample: string;
}

export interface PushTemplateDef {
  key: PushTemplateKey;
  group: PushTemplateGroup;
  /** Название сценария в админке. */
  label: string;
  /** Когда уходит — описание триггера для админа. */
  when: string;
  vars: PushTemplateVar[];
  defaults: PushText;
}

export const PUSH_GROUP_LABELS: Record<PushTemplateGroup, string> = {
  engagement: 'Вовлечение — вечером по местному времени',
  cycle: 'Напоминания по недельному циклу',
  tasks: 'Задания',
  subscription: 'Подписка',
};

/** Имя, если у игрока его нет: «Привет, чемпион!». */
export const NAME_FALLBACK = 'чемпион';
/** Тренер без имени: «Задание от {coach}» → «Задание от тренера». */
export const COACH_FALLBACK = 'тренера';

const NAME: PushTemplateVar = { key: 'name', hint: 'имя игрока (если не указано — «чемпион»)', sample: 'Миша' };
const STREAK: PushTemplateVar = { key: 'streak', hint: 'длина серии со словом: «3 дня»', sample: '5 дней' };

export const PUSH_TEMPLATES: PushTemplateDef[] = [
  {
    key: 'onboarding1',
    group: 'engagement',
    label: 'Новичок: 1-й день',
    when: 'Через день после регистрации, если ещё ни одной тренировки.',
    vars: [NAME],
    defaults: {
      title: 'Начнём? Это займёт 15 минут ⚡️',
      body: 'ИИ-тренер уже собрал первую тренировку под тебя. Попробуй — просто нажми «начать».',
    },
  },
  {
    key: 'onboarding2',
    group: 'engagement',
    label: 'Новичок: 3-й день',
    when: 'На 3-й день после регистрации, если так и не было тренировок.',
    vars: [NAME],
    defaults: {
      title: 'Твой потенциал ждёт 📈',
      body: 'Пройди первую тренировку — и увидишь, как растут твои характеристики.',
    },
  },
  {
    key: 'onboarding3',
    group: 'engagement',
    label: 'Новичок: 7-й день',
    when: 'На 7-й день после регистрации, если так и не было тренировок. Последнее из трёх.',
    vars: [NAME],
    defaults: {
      title: 'Загляни на минутку 🏒',
      body: 'Короткие видео от тренеров-профи — бесплатно. Начни с них, если на тренировку пока нет времени.',
    },
  },
  {
    key: 'streak',
    group: 'engagement',
    label: 'Серия под угрозой (2 дня)',
    when: 'Серия 2 дня, вчера была тренировка, сегодня ещё нет — вечером, пока серию можно спасти.',
    vars: [NAME, STREAK],
    defaults: {
      title: '🔥 Твоя серия — {streak}. Не разрывай её!',
      body: 'Потренируйся сегодня, чтобы не обнулить серию.',
    },
  },
  {
    key: 'streakTempo',
    group: 'engagement',
    label: 'Серия под угрозой (3+ дня, «Ударный темп»)',
    when: 'То же, но серия от 3 дней: у игрока горит «Ударный темп» ×2 к опыту.',
    vars: [NAME, STREAK],
    defaults: {
      title: '🔥 Твоя серия — {streak}. Не разрывай её!',
      body: 'Потренируйся сегодня — иначе сгорит ударный темп (×2 к опыту).',
    },
  },
  {
    key: 'missed',
    group: 'engagement',
    label: 'Пропуск 2 дня',
    when: 'Игрок уже тренировался, но последние 2 дня — нет (вчера и сегодня). Один раз на каждый перерыв.',
    vars: [NAME],
    defaults: {
      title: '{name}, ты не тренировался 2 дня',
      body: 'Вернись сегодня — ИИ-тренер соберёт короткую тренировку, и характеристики снова пойдут вверх.',
    },
  },
  {
    key: 'dusty',
    group: 'engagement',
    label: 'Долгий перерыв (без подписки)',
    when: 'Нет подписки и нет тренировок 4+ дня. Повтор не чаще раза в 4 дня.',
    vars: [NAME],
    defaults: {
      title: 'Гантели уже запылились! 🏋️',
      body: 'Пора как следует потренироваться. ИИ-тренер соберёт занятие под твоё состояние.',
    },
  },
  {
    key: 'dailyReminder1',
    group: 'cycle',
    label: 'Тренировка дня, вариант 1',
    when: 'Пн–Пт во время из «Время уведомлений», если день цикла не выполнен. Варианты 1 и 2 чередуются по дням.',
    vars: [NAME, { key: 'day', hint: 'тренировка дня: «Разминка», «В тонусе»…', sample: 'В тонусе' }],
    defaults: {
      title: 'Привет, {name}! Время тренировки 💪',
      body: 'Стабильность — признак мастерства. Не забудь потренироваться — сегодня у тебя «{day}».',
    },
  },
  {
    key: 'dailyReminder2',
    group: 'cycle',
    label: 'Тренировка дня, вариант 2',
    when: 'Как вариант 1 — в другие дни.',
    vars: [NAME, { key: 'day', hint: 'тренировка дня: «Разминка», «В тонусе»…', sample: 'Заряжен' }],
    defaults: {
      title: '{name}, дисциплина бьёт класс! 🔥',
      body: 'Пора тренироваться! Сегодня у тебя «{day}».',
    },
  },
  {
    key: 'microcycleReady',
    group: 'cycle',
    label: 'Новая неделя готова',
    when: 'Воскресенье вечером, когда ИИ-тренер собрал игроку неделю.',
    vars: [NAME],
    defaults: {
      title: 'Новый микроцикл готов',
      body: 'ИИ-тренер собрал тебе неделю. Открой календарь.',
    },
  },
  {
    key: 'assignmentNew',
    group: 'tasks',
    label: 'Задание от тренера',
    when: 'Сразу, когда тренер назначил игроку задание.',
    vars: [NAME, { key: 'coach', hint: 'имя и фамилия тренера (если не указано — «тренера»)', sample: 'Иван Петров' }],
    defaults: {
      title: 'Задание от тренера!',
      body: 'Привет, чемпион! Тебе прилетела тренировка от тренера. Вперёд к выполнению 💪',
    },
  },
  {
    key: 'parentTaskNew',
    group: 'tasks',
    label: 'Задание от родителя',
    when: 'Сразу, когда родитель дал ребёнку задание в кабинете.',
    vars: [NAME, { key: 'from', hint: '«от мамы», «от папы» или «от родителя»', sample: 'от мамы' }],
    defaults: {
      title: 'Задание {from}!',
      body: 'Привет, чемпион! Тебе прилетела тренировка {from}. Вперёд к выполнению 💪',
    },
  },
  {
    key: 'subscriptionExpiry',
    group: 'subscription',
    label: 'Подписка скоро закончится',
    when: 'За 3 дня до конца подписки (только когда платный доступ включён).',
    vars: [NAME, { key: 'when', hint: '«через 3 дня» или «менее чем через сутки»', sample: 'через 3 дня' }],
    defaults: {
      title: 'Подписка скоро закончится',
      body: 'Доступ ко всем возможностям заканчивается {when}. Продли, чтобы не потерять прогресс.',
    },
  },
];

const BY_KEY = new Map(PUSH_TEMPLATES.map((t) => [t.key, t] as const));

export function getTemplateDef(key: string): PushTemplateDef | undefined {
  return BY_KEY.get(key as PushTemplateKey);
}

export const TITLE_MAX = 80;
export const BODY_MAX = 240;

export type PushTemplateOverrides = Partial<Record<PushTemplateKey, PushText>>;
export type PushTemplates = Record<PushTemplateKey, PushText>;

export const DEFAULT_PUSH_TEMPLATES: PushTemplates = Object.fromEntries(
  PUSH_TEMPLATES.map((t) => [t.key, t.defaults]),
) as PushTemplates;

/** Стандартные тексты + то, что сохранил админ. Битые записи игнорируются. */
export function mergeTemplates(overrides: unknown): PushTemplates {
  const out: PushTemplates = { ...DEFAULT_PUSH_TEMPLATES };
  if (!overrides || typeof overrides !== 'object') return out;
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    const def = getTemplateDef(key);
    if (!def || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    if (typeof v.title !== 'string' || typeof v.body !== 'string') continue;
    if (validateTemplate(key, { title: v.title, body: v.body })) continue;
    out[def.key] = { title: v.title.trim(), body: v.body.trim() };
  }
  return out;
}

/** Разбор JSON из app_settings (битый JSON → только стандартные тексты). */
export function parseTemplates(raw: string | null | undefined): PushTemplates {
  if (!raw) return { ...DEFAULT_PUSH_TEMPLATES };
  try {
    return mergeTemplates(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PUSH_TEMPLATES };
  }
}

function placeholders(s: string): string[] {
  return Array.from(s.matchAll(/\{([^{}]*)\}/g), (m) => m[1]!.trim());
}

/** Проверка текста из админки. Возвращает ошибку по-русски или null. */
export function validateTemplate(key: string, text: { title: unknown; body: unknown }): string | null {
  const def = getTemplateDef(key);
  if (!def) return 'Неизвестный сценарий';
  if (typeof text.title !== 'string' || typeof text.body !== 'string') return 'Заполните заголовок и текст';
  const title = text.title.trim();
  const body = text.body.trim();
  if (!title) return 'Заголовок не может быть пустым';
  if (!body) return 'Текст не может быть пустым';
  if (Array.from(title).length > TITLE_MAX) return `Заголовок длиннее ${TITLE_MAX} символов`;
  if (Array.from(body).length > BODY_MAX) return `Текст длиннее ${BODY_MAX} символов`;
  const allowed = new Set(def.vars.map((v) => v.key));
  const list = def.vars.map((v) => `{${v.key}}`).join(', ');
  const unknown = [...placeholders(title), ...placeholders(body)].filter((p) => !allowed.has(p));
  if (unknown.length) return `Неизвестная переменная {${unknown[0]}}. Можно: ${list}`;
  // Одиночные скобки («{name», «{{name}}») ушли бы игроку как есть
  const stray = (s: string) => /[{}]/.test(s.replace(/\{[^{}]*\}/g, ''));
  if (stray(title) || stray(body)) return `Лишняя фигурная скобка. Переменные пишутся так: ${list}`;
  return null;
}

/**
 * Заглавная — только если фраза начинается с буквы (после эмодзи/кавычек).
 * «{streak} подряд» → «5 дней подряд», а не «5 Дней»: первая значимая литера —
 * цифра, её не трогаем.
 */
function capitalizeFirst(s: string): string {
  const chars = Array.from(s);
  const i = chars.findIndex((c) => /[\p{L}\p{N}]/u.test(c));
  if (i < 0 || !/\p{L}/u.test(chars[i]!)) return s;
  chars[i] = chars[i]!.toLocaleUpperCase('ru-RU');
  return chars.join('');
}

function fill(s: string, vars: Record<string, string>): string {
  const out = s
    .replace(/\{([^{}]*)\}/g, (_, k: string) => vars[k.trim()] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  // «{name}, дисциплина…» → «Чемпион, дисциплина…»: первая буква фразы — заглавная
  return capitalizeFirst(out);
}

/**
 * Готовый текст пуша. name пустой → «чемпион». Первая буква заголовка и
 * текста — заглавная (переменная в начале фразы).
 */
export function renderPush(
  templates: PushTemplates,
  key: PushTemplateKey,
  vars: Record<string, string | null | undefined> = {},
): PushText {
  const t = templates[key] ?? DEFAULT_PUSH_TEMPLATES[key];
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) clean[k] = (v ?? '').trim();
  if (!clean.name) clean.name = NAME_FALLBACK;
  if ('coach' in clean && !clean.coach) clean.coach = COACH_FALLBACK;
  return { title: fill(t.title, clean), body: fill(t.body, clean) };
}

/** Предпросмотр в админке — на примерах переменных. */
export function previewPush(key: PushTemplateKey, text: PushText): PushText {
  const def = getTemplateDef(key)!;
  const sample = Object.fromEntries(def.vars.map((v) => [v.key, v.sample]));
  return renderPush({ ...DEFAULT_PUSH_TEMPLATES, [key]: text }, key, sample);
}
