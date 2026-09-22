import { describe, it, expect } from 'vitest';
import {
  BODY_MAX,
  DEFAULT_PUSH_TEMPLATES,
  PUSH_TEMPLATES,
  TITLE_MAX,
  mergeTemplates,
  parseTemplates,
  previewPush,
  renderPush,
  validateTemplate,
} from '../../src/lib/notifications/templates';

describe('реестр шаблонов', () => {
  it('стандартные тексты проходят собственную проверку', () => {
    for (const t of PUSH_TEMPLATES) {
      expect(validateTemplate(t.key, t.defaults), t.key).toBeNull();
    }
  });

  it('ключи уникальны, у каждого есть описание «когда уходит»', () => {
    const keys = PUSH_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of PUSH_TEMPLATES) expect(t.when.length).toBeGreaterThan(10);
  });
});

describe('renderPush', () => {
  it('подставляет переменные', () => {
    const t = renderPush(DEFAULT_PUSH_TEMPLATES, 'parentTaskNew', { from: 'от мамы' });
    expect(t).toEqual({
      title: 'Задание от мамы!',
      body: 'Привет, чемпион! Тебе прилетела тренировка от мамы. Вперёд к выполнению 💪',
    });
  });

  it('пустое имя → «чемпион», в начале фразы — с заглавной', () => {
    const t = renderPush(DEFAULT_PUSH_TEMPLATES, 'dailyReminder2', { name: '  ', day: 'Разминка' });
    expect(t.title).toBe('Чемпион, дисциплина бьёт класс! 🔥');
  });

  it('заглавная буква — первая буква, даже после эмодзи', () => {
    const custom = { ...DEFAULT_PUSH_TEMPLATES, streak: { title: '🔥 {name}, держись', body: 'ок' } };
    expect(renderPush(custom, 'streak', { name: 'миша' }).title).toBe('🔥 Миша, держись');
  });

  it('пустая переменная не оставляет двойных пробелов', () => {
    const custom = { ...DEFAULT_PUSH_TEMPLATES, parentTaskNew: { title: 'Задание', body: 'Тренировка {from} для тебя' } };
    expect(renderPush(custom, 'parentTaskNew', { from: '' }).body).toBe('Тренировка для тебя');
  });
});

describe('validateTemplate', () => {
  it('неизвестная переменная — ошибка с подсказкой', () => {
    const err = validateTemplate('streak', { title: 'Серия {days}', body: 'x' });
    expect(err).toContain('{days}');
    expect(err).toContain('{streak}');
  });

  it('переменная из другого сценария не проходит', () => {
    expect(validateTemplate('dusty', { title: 'Привет {coach}', body: 'x' })).toMatch(/Неизвестная переменная/);
  });

  it('пустые поля и длина', () => {
    expect(validateTemplate('dusty', { title: ' ', body: 'x' })).toMatch(/Заголовок/);
    expect(validateTemplate('dusty', { title: 'x', body: '' })).toMatch(/Текст/);
    expect(validateTemplate('dusty', { title: 'x'.repeat(TITLE_MAX + 1), body: 'x' })).toMatch(/длиннее/);
    expect(validateTemplate('dusty', { title: 'x', body: 'x'.repeat(BODY_MAX + 1) })).toMatch(/длиннее/);
  });

  it('длина считается по символам: эмодзи — один символ', () => {
    expect(validateTemplate('dusty', { title: '🔥'.repeat(TITLE_MAX), body: 'x' })).toBeNull();
  });

  it('неизвестный сценарий', () => {
    expect(validateTemplate('nope', { title: 'x', body: 'x' })).toBe('Неизвестный сценарий');
  });
});

describe('хранение', () => {
  it('битый JSON и мусор — стандартные тексты', () => {
    expect(parseTemplates('{oops')).toEqual(DEFAULT_PUSH_TEMPLATES);
    expect(parseTemplates(null)).toEqual(DEFAULT_PUSH_TEMPLATES);
    expect(mergeTemplates({ nope: { title: 'a', body: 'b' }, dusty: 'x' })).toEqual(DEFAULT_PUSH_TEMPLATES);
  });

  it('сохранённая правка подменяет только свой сценарий', () => {
    const t = parseTemplates(JSON.stringify({ dusty: { title: 'Пыль!', body: 'Давай' } }));
    expect(t.dusty).toEqual({ title: 'Пыль!', body: 'Давай' });
    expect(t.streak).toEqual(DEFAULT_PUSH_TEMPLATES.streak);
  });

  it('невалидная сохранённая правка игнорируется (не ломает пуш)', () => {
    const t = parseTemplates(JSON.stringify({ dusty: { title: 'Привет {coach}', body: 'x' } }));
    expect(t.dusty).toEqual(DEFAULT_PUSH_TEMPLATES.dusty);
  });
});

describe('previewPush', () => {
  it('предпросмотр на примерах переменных', () => {
    expect(previewPush('streak', DEFAULT_PUSH_TEMPLATES.streak).title).toBe('🔥 Твоя серия — 5 дней. Не разрывай её!');
  });
});

describe('правки после ревью', () => {
  it('заглавная — только если фраза начинается с буквы: «5 дней подряд», не «5 Дней»', () => {
    const custom = { ...DEFAULT_PUSH_TEMPLATES, streak: { title: '{streak} подряд!', body: '2 дня без тренировки' } };
    const t = renderPush(custom, 'streak', { streak: '5 дней' });
    expect(t.title).toBe('5 дней подряд!');
    expect(t.body).toBe('2 дня без тренировки');
  });

  it('лишние скобки не проходят проверку', () => {
    expect(validateTemplate('dusty', { title: '{{name}}', body: 'x' })).toMatch(/Лишняя фигурная скобка/);
    expect(validateTemplate('dusty', { title: 'Привет {name', body: 'x' })).toMatch(/Лишняя фигурная скобка/);
    expect(validateTemplate('dusty', { title: 'Привет name}', body: 'x' })).toMatch(/Лишняя фигурная скобка/);
    expect(validateTemplate('dusty', { title: 'Привет {name}', body: 'x' })).toBeNull();
  });

  it('тренер без имени — «от тренера»', () => {
    const custom = { ...DEFAULT_PUSH_TEMPLATES, assignmentNew: { title: 'Задание от {coach}!', body: 'x' } };
    expect(renderPush(custom, 'assignmentNew', { coach: '' }).title).toBe('Задание от тренера!');
    expect(renderPush(custom, 'assignmentNew', { coach: 'Иван Петров' }).title).toBe('Задание от Иван Петров!');
  });
});
