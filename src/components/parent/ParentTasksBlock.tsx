'use client';

// Блок «Задания» в карточке ребёнка родительского кабинета (п.9б «Середина
// сентября», формат «счётчик»): родитель выбирает цель и число тренировок,
// ребёнок видит «Мама дала задание: Мощный бросок 1/3». Прогресс считает
// сервер по реальным тренировкам ребёнка с этой целью.

import { useState } from 'react';
import { ClipboardList, Minus, Plus, X } from 'lucide-react';
import { GoalIcon } from '@/components/training/icons';
import { GOAL_LABELS } from '@/lib/training-algorithm-v3';
import {
  PARENT_RELATIONS,
  TASK_DEFAULT_TARGET,
  TASK_MAX_TARGET,
  TASK_MIN_TARGET,
  goalLabel,
  relationWords,
  taskDisplayState,
} from '@/lib/parent-tasks';
import { plural } from '@/lib/plural';

export interface ParentTaskView {
  id: string;
  goal: string;
  target: number;
  done: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELED';
  dueDate: string;
}

const GOALS = Object.keys(GOAL_LABELS);

export default function ParentTasksBlock({
  childId,
  tasks,
  paywalled,
  defaultRelation,
  onChanged,
}: {
  childId: string;
  tasks: ParentTaskView[];
  paywalled: boolean;
  defaultRelation: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [relation, setRelation] = useState<string | null>(defaultRelation);
  const [goal, setGoal] = useState<string | null>(null);
  const [target, setTarget] = useState(TASK_DEFAULT_TARGET);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const active = tasks.filter((t) => t.status === 'ACTIVE');
  const recentDone = tasks.filter((t) => t.status === 'COMPLETED').slice(0, 3);

  const submit = async () => {
    if (!goal || !relation || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/parent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, goal, target, relation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Не удалось дать задание');
        return;
      }
      setOpen(false);
      setGoal(null);
      setTarget(TASK_DEFAULT_TARGET);
      onChanged();
    } catch {
      setError('Сетевая ошибка. Проверь подключение.');
    } finally {
      setSaving(false);
    }
  };

  const cancelTask = async (id: string) => {
    if (!window.confirm('Отменить задание?')) return;
    const res = await fetch(`/api/parent/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) onChanged();
  };

  return (
    <div className="rounded-xl bg-white/5 p-3 mt-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-muted text-[11px] font-overpass uppercase tracking-wide">Задания</div>
        {!paywalled && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 bg-brand text-night rounded-full py-1.5 px-3 text-xs font-bold font-overpass uppercase transition-transform active:scale-95"
          >
            <Plus size={16} aria-hidden />
            Дать задание
          </button>
        )}
      </div>

      {paywalled && (
        <p className="text-muted text-xs leading-snug mb-2">
          Задания доступны при активной подписке ребёнка: задание ведёт в персональную тренировку ИИ-тренера.
        </p>
      )}

      {!paywalled && active.length === 0 && recentDone.length === 0 && !open && (
        <p className="text-muted text-xs leading-snug">
          Выберите цель — например, «Мощный бросок» — и сколько тренировок на неё сделать. Ребёнок увидит,
          что задание от вас.
        </p>
      )}

      {/* Активные и недавно выполненные */}
      <div className="flex flex-col gap-2">
        {[...active, ...recentDone].map((t) => {
          const state = taskDisplayState(t, now);
          const done = Math.min(t.done, t.target);
          return (
            <div key={t.id} className="rounded-lg bg-white/5 p-2.5">
              <div className="flex items-center gap-2">
                <GoalIcon goal={t.goal} size={16} color="#A1FF4A" />
                <span className="text-white text-sm font-bold flex-1 min-w-0 truncate">{goalLabel(t.goal)}</span>
                <span
                  className="text-[11px] font-bold font-overpass shrink-0"
                  style={{ color: state === 'completed' ? '#A1FF4A' : state === 'expired' ? '#FF8C4A' : '#AEABBB' }}
                >
                  {state === 'completed' ? 'Выполнено' : state === 'expired' ? 'Срок вышел' : `${done} из ${t.target}`}
                </span>
                {t.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => cancelTask(t.id)}
                    aria-label="Отменить задание"
                    className="text-muted shrink-0 -m-1 p-1"
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((done / t.target) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Форма нового задания */}
      {open && (
        <div className="mt-2 rounded-lg bg-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-sm font-bold inline-flex items-center gap-1.5">
              <ClipboardList size={16} className="text-brand" aria-hidden />
              Новое задание
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="text-muted -m-1 p-1">
              <X size={16} aria-hidden />
            </button>
          </div>

          <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1.5">Кто даёт задание</div>
          <div className="flex gap-2 mb-3">
            {PARENT_RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelation(r)}
                className="flex-1 rounded-full py-2 text-xs font-bold font-overpass uppercase"
                style={{
                  background: relation === r ? '#A1FF4A' : 'rgba(255,255,255,0.06)',
                  color: relation === r ? '#060919' : '#F9F8FE',
                }}
              >
                {relationWords(r).name}
              </button>
            ))}
          </div>

          <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1.5">Цель</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                className="flex items-center gap-2 rounded-lg py-2 px-2.5 text-left"
                style={{
                  background: goal === g ? 'rgba(161,255,74,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${goal === g ? 'rgba(161,255,74,0.5)' : 'transparent'}`,
                }}
              >
                <GoalIcon goal={g} size={16} color={goal === g ? '#A1FF4A' : '#AEABBB'} />
                <span className="text-white text-sm">{goalLabel(g)}</span>
              </button>
            ))}
          </div>

          <div className="text-muted text-[11px] font-overpass uppercase tracking-wide mb-1.5">Сколько тренировок</div>
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setTarget((t) => Math.max(TASK_MIN_TARGET, t - 1))}
              aria-label="Меньше"
              className="w-10 h-10 rounded-full bg-white/10 inline-flex items-center justify-center text-white"
            >
              <Minus size={16} aria-hidden />
            </button>
            <span className="text-white text-base font-bold min-w-[96px] text-center">
              {target} {plural(target, ['тренировка', 'тренировки', 'тренировок'])}
            </span>
            <button
              type="button"
              onClick={() => setTarget((t) => Math.min(TASK_MAX_TARGET, t + 1))}
              aria-label="Больше"
              className="w-10 h-10 rounded-full bg-white/10 inline-flex items-center justify-center text-white"
            >
              <Plus size={16} aria-hidden />
            </button>
          </div>
          <p className="text-muted text-xs mb-3">Срок — неделя. Засчитываются тренировки с этой целью.</p>

          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!goal || !relation || saving}
            className="w-full bg-brand text-night rounded-full py-2.5 px-4 text-sm font-bold font-overpass uppercase transition-transform active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Отправляем…' : 'Дать задание'}
          </button>
        </div>
      )}
    </div>
  );
}
