// Лига (геймификация, Фаза 3). Решения босса 2026-08-07 (финальное):
// - Данные (XP и т.п.) — настоящие из профилей, но ИДЕНТИЧНОСТЬ чужих
//   обезличена: каждый участник показывается под ПРАВДОПОДОБНЫМ, но ФЕЙКОВЫМ
//   именем «Имя И.» — детерминированно от userId (стабильно между показами),
//   реальные имя/фамилия чужих в выдачу не попадают НИКОГДА.
// - Свой ребёнок — реальным полным именем.
// - Эмодзи-аватар — стабильный, из ник-генератора.
// - Внизу таблицы «фейковые» слабые участники (мотивация нижних) — тот же
//   формат имён, неотличимы от обезличенных реальных.
// - Когорты по году рождения, счёт — недельный XP.
// Чистая логика — тестируется без БД.

/** Детерминированный 32-битный хэш строки (FNV-1a). */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const NICK_ADJ = [
  'Стальной', 'Ледяной', 'Быстрый', 'Меткий', 'Хитрый', 'Смелый', 'Резкий',
  'Гибкий', 'Мощный', 'Ловкий', 'Дерзкий', 'Упорный', 'Точный', 'Шустрый',
  'Крепкий', 'Внезапный',
];
const NICK_NOUN = [
  'Форвард', 'Защитник', 'Снайпер', 'Капитан', 'Бомбардир', 'Вратарь',
  'Плеймейкер', 'Центр', 'Крайний', 'Ветеран', 'Новобранец', 'Тафгай',
];
const NICK_EMOJI = ['🏒', '⛸️', '🥅', '🧊', '🚀', '⚡', '🛡️', '🎯', '🔥', '🦾'];

/**
 * Стабильный ник по userId: один и тот же юзер всегда под одним ником, но
 * связать ник с реальным ребёнком извне нельзя. Номер добавляет уникальности
 * при коллизиях пар (10 эмодзи × 16 × 12 = 1920 комбинаций + число).
 */
export function nicknameFor(userId: string): { name: string; emoji: string } {
  const h = hash32(userId);
  const adj = NICK_ADJ[h % NICK_ADJ.length];
  const noun = NICK_NOUN[(h >>> 4) % NICK_NOUN.length];
  const emoji = NICK_EMOJI[(h >>> 8) % NICK_EMOJI.length];
  const num = (h >>> 12) % 90 + 10; // 10..99
  return { name: `${adj} ${noun} ${num}`, emoji };
}

// Правдоподобные обезличенные имена: популярные русские мужские имена +
// инициалы. Генерация детерминированная от сида (userId реального участника
// или сид фейка) — это НЕ настоящие имена, связи с реальным ребёнком нет.
const FAKE_FIRST = [
  'Артём', 'Миша', 'Даня', 'Кирилл', 'Матвей', 'Егор', 'Тимофей', 'Ваня',
  'Саша', 'Лёва', 'Марк', 'Никита', 'Глеб', 'Максим', 'Дима', 'Рома',
];
const FAKE_INITIAL = [
  'А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'С',
];

/** Правдоподобное обезличенное имя «Имя И.» — детерминированно от сида. */
export function plausibleNameFor(seed: string): string {
  const h = hash32(seed);
  const first = FAKE_FIRST[h % FAKE_FIRST.length];
  const initial = FAKE_INITIAL[(h >>> 4) % FAKE_INITIAL.length];
  return `${first} ${initial}.`;
}

export interface LeagueEntry {
  userId: string;
  weeklyXp: number;
}

export interface LeagueRow {
  rank: number;
  name: string;
  emoji: string;
  weeklyXp: number;
  isOwn: boolean;
  isFake: boolean;
}

export interface LeagueStandings {
  rows: LeagueRow[];
  ownRank: number;
  totalReal: number;
  /** «Сильнее X% сверстников» (по реальным участникам, без фейков) */
  percentile: number;
}

/** Сколько фейков подкладываем, если свой ребёнок в самом низу. */
const FAKE_PAD = 3;
const FAKE_NAMES_SEED = 'trenki-league-fakes';

/**
 * Таблица лиги для одного ребёнка. entries — реальные участники когорты
 * (включая самого ребёнка), childUserId — чей это кабинет, childName —
 * реальное имя (своего показываем по-настоящему), weekSeed — стабильность
 * фейков внутри недели (напр. '2026-W32-2013').
 * Сортировка: XP по убыванию, при равенстве — стабильно по нику.
 */
export function buildStandings(
  entries: LeagueEntry[],
  childUserId: string,
  childName: string,
  weekSeed: string,
  topN: number = 10,
): LeagueStandings | null {
  const child = entries.find((e) => e.userId === childUserId);
  if (!child) return null;

  const decorated = entries.map((e) => {
    const nick = nicknameFor(e.userId);
    const own = e.userId === childUserId;
    return {
      // Чужие — правдоподобное ФЕЙКОВОЕ имя от userId (стабильное, но без
      // связи с реальным ребёнком), свой — реальное имя. Эмодзи из ника.
      name: own ? childName : plausibleNameFor(e.userId),
      emoji: own ? '⭐' : nick.emoji,
      weeklyXp: e.weeklyXp,
      isOwn: own,
      isFake: false,
      sortKey: nick.name,
    };
  });
  decorated.sort((a, b) => b.weeklyXp - a.weeklyXp || a.sortKey.localeCompare(b.sortKey));

  const ownIdx = decorated.findIndex((r) => r.isOwn);
  const totalReal = decorated.length;
  // Перцентиль: скольких реальных сверстников ребёнок опережает
  const percentile = totalReal <= 1 ? 100 : Math.round(((totalReal - 1 - ownIdx) / (totalReal - 1)) * 100);

  // Фейки — только если свой в нижней части: подкладываем более слабых, чтобы
  // не быть последним. XP фейков строго ниже своего (или 0 при нуле).
  const needFakes = ownIdx >= totalReal - 1;
  const fakes: typeof decorated = [];
  if (needFakes) {
    const ownXp = decorated[ownIdx].weeklyXp;
    for (let i = 0; i < FAKE_PAD; i++) {
      const fakeSeed = `${FAKE_NAMES_SEED}:${weekSeed}:${i}`;
      const name = plausibleNameFor(fakeSeed);
      const nick = nicknameFor(fakeSeed); // эмодзи как у остальных участников
      const factor = (FAKE_PAD - i) / (FAKE_PAD + 1); // 0.75, 0.5, 0.25 при PAD=3
      fakes.push({
        name,
        emoji: nick.emoji,
        weeklyXp: Math.max(0, Math.floor(ownXp * factor)),
        isOwn: false,
        isFake: true,
        sortKey: nick.name,
      });
    }
  }

  const all = [...decorated, ...fakes];
  all.sort((a, b) => b.weeklyXp - a.weeklyXp || a.sortKey.localeCompare(b.sortKey));
  // При ownXp=0 фейки тоже 0 и алфавитная сортировка могла поднять их выше
  // своего — а фейк по смыслу обязан быть НИЖЕ. Переносим такие фейки под своего.
  const equalFakesAbove = all.filter(
    (r, i) => r.isFake && i < all.findIndex((x) => x.isOwn) && r.weeklyXp === child.weeklyXp,
  );
  for (const f of equalFakesAbove) {
    all.splice(all.indexOf(f), 1);
    all.splice(all.findIndex((r) => r.isOwn) + 1, 0, f);
  }

  const finalOwnIdx = all.findIndex((r) => r.isOwn);
  // Окно: топ-N, но свой всегда виден (если ниже топа — показываем топ и хвост вокруг своего)
  let rows: typeof all;
  if (finalOwnIdx < topN) {
    rows = all.slice(0, Math.max(topN, finalOwnIdx + FAKE_PAD + 1));
  } else {
    rows = [...all.slice(0, 3), ...all.slice(finalOwnIdx - 1, finalOwnIdx + FAKE_PAD + 1)];
  }

  const ranked: LeagueRow[] = rows.map((r) => ({
    rank: all.indexOf(r) + 1,
    name: r.name,
    emoji: r.emoji,
    weeklyXp: r.weeklyXp,
    isOwn: r.isOwn,
    isFake: r.isFake,
  }));

  return {
    rows: ranked,
    ownRank: finalOwnIdx + 1,
    totalReal,
    percentile,
  };
}

/** ISO-неделя для сидов фейков и подписи («2026-W32»). */
export function isoWeekLabel(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
