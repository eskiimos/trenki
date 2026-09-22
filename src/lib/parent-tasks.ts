// Задания от родителя (правка «Середина сентября», п.9б, формат «счётчик»):
// родитель выбирает цель и число тренировок, ребёнок видит «Мама дала задание:
// Мощный бросок 1/3». Здесь — чистая логика без БД (подписи, проверки, тексты
// пуша и письма). Запросы — src/lib/parent-tasks-server.ts. Тесты —
// tests/lib/parent-tasks.test.ts.

import { GOAL_LABELS } from '@/lib/training-algorithm-v3';
import { plural } from '@/lib/plural';
import { DEFAULT_PUSH_TEMPLATES, renderPush, type PushTemplates } from '@/lib/notifications/templates';

export const PARENT_RELATIONS = ['MOTHER', 'FATHER', 'OTHER'] as const;
export type ParentRelationValue = (typeof PARENT_RELATIONS)[number];

export const TASK_MIN_TARGET = 1;
export const TASK_MAX_TARGET = 5;
export const TASK_DEFAULT_TARGET = 3;
/** Срок задания: неделя — как у недели ИИ-тренера. */
export const TASK_DUE_DAYS = 7;
/** Больше трёх заданий сразу — уже не «задание», а давление на ребёнка. */
export const TASK_MAX_ACTIVE_PER_CHILD = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Подписи по тому, кто дал задание. */
export function relationWords(relation: string | null | undefined): {
  /** «Мама» — в выборе у родителя */
  name: string;
  /** «Мама дала задание» — заголовок у ребёнка */
  gave: string;
  /** «от мамы» — в тексте пуша */
  from: string;
} {
  switch (relation) {
    case 'MOTHER':
      return { name: 'Мама', gave: 'Мама дала задание', from: 'от мамы' };
    case 'FATHER':
      return { name: 'Папа', gave: 'Папа дал задание', from: 'от папы' };
    default:
      return { name: 'Родитель', gave: 'Задание от родителя', from: 'от родителя' };
  }
}

export function goalLabel(goal: string): string {
  return GOAL_LABELS[goal]?.label ?? 'Тренировка';
}

/** «Мощный бросок · 1/3» */
export function taskProgressLabel(goal: string, done: number, target: number): string {
  return `${goalLabel(goal)} · ${Math.min(done, target)}/${target}`;
}

export type TaskDisplayState = 'active' | 'completed' | 'expired' | 'canceled';

export function taskDisplayState(
  task: { status: string; dueDate: Date | string },
  now: Date,
): TaskDisplayState {
  if (task.status === 'COMPLETED') return 'completed';
  if (task.status === 'CANCELED') return 'canceled';
  return new Date(task.dueDate).getTime() < now.getTime() ? 'expired' : 'active';
}

export function taskDueDate(now: Date): Date {
  return new Date(now.getTime() + TASK_DUE_DAYS * DAY_MS);
}

export interface NewTaskInput {
  goal: unknown;
  target: unknown;
  relation: unknown;
}

/**
 * Проверка нового задания. activeGoals — цели уже активных заданий этого
 * ребёнка (от любого родителя). Возвращает текст ошибки для родителя или null.
 */
export function validateNewTask(input: NewTaskInput, activeGoals: readonly string[]): string | null {
  if (typeof input.goal !== 'string' || !GOAL_LABELS[input.goal]) return 'Выберите цель';
  const target = Number(input.target);
  if (!Number.isInteger(target) || target < TASK_MIN_TARGET || target > TASK_MAX_TARGET) {
    return `Число тренировок — от ${TASK_MIN_TARGET} до ${TASK_MAX_TARGET}`;
  }
  if (typeof input.relation !== 'string' || !(PARENT_RELATIONS as readonly string[]).includes(input.relation)) {
    return 'Укажите, кто даёт задание';
  }
  if (activeGoals.includes(input.goal)) return 'Задание на эту цель уже есть — дождитесь, пока ребёнок его выполнит';
  if (activeGoals.length >= TASK_MAX_ACTIVE_PER_CHILD) {
    return `Не больше ${TASK_MAX_ACTIVE_PER_CHILD} заданий одновременно`;
  }
  return null;
}

/**
 * Пуш ребёнку о новом задании — шаблон parentTaskNew из админки ({from} —
 * «от мамы»/«от папы»/«от родителя»). Эмодзи в системном пуше допустимы.
 */
export function parentTaskPush(
  relation: string | null | undefined,
  templates: PushTemplates = DEFAULT_PUSH_TEMPLATES,
  name?: string | null,
): { title: string; body: string } {
  return renderPush(templates, 'parentTaskNew', { from: relationWords(relation).from, name });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Письмо родителю: задание выполнено (пушей у родителей обычно нет). */
export function taskCompletedEmail(input: {
  childName: string;
  goal: string;
  target: number;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const goal = goalLabel(input.goal);
  // Формулировки без рода: пол ребёнка не угадываем.
  const subject = `Задание выполнено: ${goal} — ${input.childName}`;
  // «из 1 тренировки», «из 3 тренировок» — родительный падеж
  const unit = plural(input.target, ['тренировки', 'тренировок', 'тренировок']);
  const line = `${input.childName}: ${input.target} из ${input.target} ${unit} на цель «${goal}». Задание выполнено!`;
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
        <tr><td style="background: linear-gradient(135deg, #101530 0%, #1a1f3a 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: #A1FF4A; font-size: 32px; margin: 0; font-weight: bold;">ТРЕНЬКИ</h1>
          <p style="color: #ffffff; font-size: 16px; margin: 8px 0 0 0;">Задание выполнено 🏆</p>
        </td></tr>
        <tr><td style="padding: 28px 26px;">
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">${escapeHtml(line)}</p>
          <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
            Самое время похвалить — и дать новое задание в родительском кабинете:
            <a href="https://trenki.app/parent" style="color: #6b8f3c;">trenki.app/parent</a>
          </p>
        </td></tr>
        <tr><td style="background-color: #f8f8f8; padding: 18px 26px; text-align: center;">
          <p style="color: #999999; font-size: 12px; margin: 0;">
            Не хотите получать письма? <a href="${escapeHtml(input.unsubscribeUrl)}" style="color: #999999;">Отписаться</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `${line}\n\nНовое задание — в родительском кабинете: https://trenki.app/parent\n\nОтписаться: ${input.unsubscribeUrl}`;
  return { subject, html, text };
}
