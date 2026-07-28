'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Опрос после цикла. Показывается, когда GET /api/microcycle/current возвращает
// awaitingFeedback: true. После ответа закрывает цикл (PATCH .../feedback)
// и редиректит на экран результатов.

interface Props {
  open: boolean;
  microcycleId: string;
  cycleNumber: number;
  onClose: () => void;
  /** Вызывается после успешной отправки фидбэка (чтобы родитель перезагрузил состояние) */
  onSubmitted?: () => void;
  /** Сколько тренировок недели выполнено. 0 → вместо опроса показываем поддержку. */
  completedCount?: number;
}

type Choice = 'EASY' | 'NORMAL' | 'HARD';

const CHOICES: Array<{ key: Choice; emoji: string; label: string; hint: string }> = [
  { key: 'EASY',   emoji: '😎', label: 'Изи',    hint: 'было слишком легко' },
  { key: 'NORMAL', emoji: '👌', label: 'Норм',   hint: 'в самый раз' },
  { key: 'HARD',   emoji: '😮‍💨', label: 'Тяжко', hint: 'на пределе' },
];

export default function MicrocycleFeedbackModal({
  open,
  microcycleId,
  cycleNumber,
  onClose,
  onSubmitted,
  completedCount,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ackSubmitting, setAckSubmitting] = useState(false);
  // Неделя без единой выполненной тренировки — оценивать нечего.
  const zeroWeek = completedCount === 0;

  if (!open) return null;

  // Закрыть неделю без оценки (экран «ни одной тренировки»).
  const handleAcknowledge = async (goTrain: boolean) => {
    if (ackSubmitting) return;
    setError(null);
    setAckSubmitting(true);
    try {
      const res = await fetch(`/api/microcycle/${microcycleId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledge: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось закрыть неделю');
      }
      onSubmitted?.();
      if (goTrain) {
        router.push('/training/assessment');
        return;
      }
      // «Позже» — просто закрываем окно. router.push('/') не годится: модалка
      // живёт на главной, навигация «в себя» не размонтирует её и окно зависало.
      setAckSubmitting(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      setAckSubmitting(false);
    }
  };

  const handlePick = async (choice: Choice) => {
    if (submitting) return;
    setError(null);
    setSubmitting(choice);
    try {
      const res = await fetch(`/api/microcycle/${microcycleId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: choice }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Не удалось сохранить ответ');
      }
      onSubmitted?.();
      router.push(`/microcycle/${microcycleId}/result`);
    } catch (err: any) {
      setError(err?.message || 'Ошибка');
      setSubmitting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fadeIn"
      // Намеренно не закрываем по клику на backdrop — это важный опрос.
    >
      <div
        className="bg-[#101530] w-full rounded-t-3xl animate-slideUp"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
      >
        <div className="px-6 pt-6 pb-2 flex justify-between items-start">
          <div>
            <div
              className="font-overpass uppercase"
              style={{
                color: '#A1FF4A',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.5px',
                marginBottom: 6,
              }}
            >
              микроцикл №{cycleNumber} закрыт
            </div>
            <h2
              className="font-overpass"
              style={{
                color: '#F9F8FE',
                fontSize: 20,
                fontWeight: 800,
                lineHeight: '120%',
              }}
            >
              {zeroWeek ? 'Ни одной тренировки :(' : 'Как перенёс неделю?'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-white/40 hover:text-white/70 text-xl leading-none"
            style={{ marginTop: -4 }}
          >
            ✕
          </button>
        </div>

        <div className="px-6 pt-2 pb-4">
          <p
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 13, lineHeight: 1.45 }}
          >
            {zeroWeek
              ? 'На этой неделе ты не выполнил ни одной тренировки. Бывает — главное вернуться. Начнём новую неделю?'
              : 'Ответ важен — на его основе ИИ-тренер подберёт следующий цикл под твою реальную форму.'}
          </p>
        </div>

        {/* Нулевая неделя: вместо опроса — поддержка и путь обратно в тренировки */}
        {zeroWeek ? (
          <div className="px-6 pt-2 flex flex-col gap-2">
            <button
              type="button"
              disabled={ackSubmitting}
              onClick={() => handleAcknowledge(true)}
              className="font-overpass uppercase rounded-2xl px-4 py-4 transition-all duration-150"
              style={{
                background: '#A1FF4A',
                color: '#060919',
                fontWeight: 900,
                fontSize: 15,
                letterSpacing: '0.5px',
                border: 'none',
                cursor: ackSubmitting ? 'wait' : 'pointer',
                opacity: ackSubmitting ? 0.6 : 1,
              }}
            >
              {ackSubmitting ? 'Секунду…' : 'Начать тренировку'}
            </button>
            <button
              type="button"
              disabled={ackSubmitting}
              onClick={() => handleAcknowledge(false)}
              className="font-overpass uppercase rounded-2xl px-4 py-3 transition-all duration-150"
              style={{
                background: 'rgba(174, 171, 187, 0.08)',
                border: '1px solid rgba(174, 171, 187, 0.2)',
                color: '#AEABBB',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.5px',
                cursor: ackSubmitting ? 'wait' : 'pointer',
              }}
            >
              Позже
            </button>
          </div>
        ) : (
        <div className="px-6 pt-2 flex flex-col gap-2">
          {CHOICES.map((c) => {
            const isPicked = submitting === c.key;
            const disabled = submitting !== null;
            return (
              <button
                key={c.key}
                type="button"
                disabled={disabled}
                onClick={() => handlePick(c.key)}
                className="flex items-center gap-4 rounded-2xl px-4 py-4 transition-all duration-150"
                style={{
                  background: isPicked ? 'rgba(161, 255, 74, 0.18)' : 'rgba(174, 171, 187, 0.08)',
                  border: `1px solid ${isPicked ? 'rgba(161, 255, 74, 0.5)' : 'rgba(174, 171, 187, 0.2)'}`,
                  opacity: disabled && !isPicked ? 0.4 : 1,
                  cursor: disabled ? 'wait' : 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: 28, lineHeight: 1 }}>{c.emoji}</div>
                <div className="flex-1">
                  <div
                    className="font-overpass uppercase"
                    style={{
                      color: '#F9F8FE',
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {c.label}
                  </div>
                  <div
                    className="font-overpass"
                    style={{ color: '#AEABBB', fontSize: 12, marginTop: 2 }}
                  >
                    {c.hint}
                  </div>
                </div>
                {isPicked && (
                  <div
                    className="font-overpass"
                    style={{ color: '#A1FF4A', fontSize: 12, fontWeight: 700 }}
                  >
                    …
                  </div>
                )}
              </button>
            );
          })}
        </div>
        )}

        {error && (
          <div
            className="font-overpass px-6 pt-3 text-center"
            style={{ color: '#FF8C4A', fontSize: 12 }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
