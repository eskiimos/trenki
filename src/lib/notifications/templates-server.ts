import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  DEFAULT_PUSH_TEMPLATES,
  PUSH_TEMPLATES,
  parseTemplates,
  type PushTemplateKey,
  type PushTemplates,
  type PushText,
} from '@/lib/notifications/templates';

// Хранение текстов пушей: одна строка app_settings с JSON { ключ: {title, body} }.
// Храним только то, что админ поменял; остальное — стандартные тексты из кода.

export const PUSH_TEMPLATES_SETTING_KEY = 'push.templates';

async function readRaw(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: PUSH_TEMPLATES_SETTING_KEY },
    select: { value: true },
  });
  return row?.value ?? null;
}

/** Актуальные тексты. Ошибка БД — стандартные тексты: пуш важнее редактуры. */
export async function getPushTemplates(): Promise<PushTemplates> {
  try {
    return parseTemplates(await readRaw());
  } catch (error) {
    logger.error('push templates read failed', error);
    return { ...DEFAULT_PUSH_TEMPLATES };
  }
}

/**
 * Сохранить текст сценария (null — вернуть стандартный). Проверку текста
 * делает роут до вызова (validateTemplate).
 */
export async function savePushTemplate(key: PushTemplateKey, text: PushText | null): Promise<PushTemplates> {
  // Читаем напрямую, без фолбэка на стандартные: при сбое чтения запись
  // перезаписала бы правки всех остальных сценариев — пусть лучше будет 500.
  const current = parseTemplates(await readRaw());
  const overrides: Record<string, PushText> = {};
  for (const t of PUSH_TEMPLATES) {
    const v = t.key === key ? text : current[t.key];
    if (!v) continue;
    if (v.title === t.defaults.title && v.body === t.defaults.body) continue;
    overrides[t.key] = { title: v.title.trim(), body: v.body.trim() };
  }
  const value = JSON.stringify(overrides);
  await prisma.appSetting.upsert({
    where: { key: PUSH_TEMPLATES_SETTING_KEY },
    update: { value },
    create: { key: PUSH_TEMPLATES_SETTING_KEY, value },
  });
  return parseTemplates(value);
}
