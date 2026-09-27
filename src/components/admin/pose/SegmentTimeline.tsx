'use client';

// Таймлайн рабочих отрезков эталона: зелёным — упражнение, тёмным — объяснения
// и паузы (в оценке не учитываются). Границы двигаются мышью, отрезок можно
// добавить и удалить по текущему моменту видео, автоматику — пересчитать.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { AdminButton } from '@/components/admin/ui';
import { activeMs, normalizeSegments, type Segment } from '@/lib/pose/segments';

const BAR_H = 44;
const MIN_SEGMENT_MS = 500;
/** Новый отрезок по кнопке — столько секунд от текущего момента. */
const NEW_SEGMENT_MS = 5000;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Drag = { index: number; edge: 'start' | 'end' };

export default function SegmentTimeline({
  durationMs,
  initial,
  currentMs,
  onSeek,
  onSave,
  onAuto,
}: {
  durationMs: number;
  initial: Segment[];
  currentMs: number;
  onSeek: (ms: number) => void;
  onSave: (segments: Segment[]) => Promise<string | null>;
  /** Пересчитать автоматически по кадрам эталона (null — кадры ещё не загружены). */
  onAuto: (() => Segment[]) | null;
}) {
  const [segments, setSegments] = useState<Segment[]>(initial);
  const [saved, setSaved] = useState<Segment[]>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    setSegments(initial);
    setSaved(initial);
  }, [initial]);

  const dirty = useMemo(() => JSON.stringify(segments) !== JSON.stringify(saved), [segments, saved]);
  const pct = (ms: number) => `${(Math.max(0, Math.min(durationMs, ms)) / Math.max(1, durationMs)) * 100}%`;

  const msFromClientX = (clientX: number) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(durationMs, ((clientX - r.left) / r.width) * durationMs));
  };

  // Перетаскивание границы: соседей не перепрыгиваем, отрезок не схлопываем
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const ms = Math.round(msFromClientX(e.clientX));
      setSegments((prev) => {
        const next = prev.map((s) => ({ ...s }));
        const seg = next[drag.index];
        if (!seg) return prev;
        const prevEnd = drag.index > 0 ? next[drag.index - 1]!.endMs : 0;
        const nextStart = drag.index < next.length - 1 ? next[drag.index + 1]!.startMs : durationMs;
        if (drag.edge === 'start') seg.startMs = Math.max(prevEnd, Math.min(ms, seg.endMs - MIN_SEGMENT_MS));
        else seg.endMs = Math.min(nextStart, Math.max(ms, seg.startMs + MIN_SEGMENT_MS));
        return next;
      });
    };
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setSegments((prev) => normalizeSegments(prev, durationMs));
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const indexAt = (ms: number) => segments.findIndex((s) => ms >= s.startMs && ms < s.endMs);

  const addAtPlayhead = () => {
    const start = Math.min(currentMs, Math.max(0, durationMs - MIN_SEGMENT_MS));
    const next = normalizeSegments([...segments, { startMs: start, endMs: Math.min(durationMs, start + NEW_SEGMENT_MS) }], durationMs);
    setSegments(next);
    setMsg(null);
  };

  const removeAtPlayhead = () => {
    const i = indexAt(currentMs);
    if (i < 0) {
      setMsg({ type: 'err', text: 'Поставьте видео на отрезок, который надо убрать' });
      return;
    }
    setSegments(segments.filter((_, idx) => idx !== i));
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const error = await onSave(segments);
    setSaving(false);
    if (error) {
      setMsg({ type: 'err', text: error });
      return;
    }
    setSaved(segments);
    setMsg({ type: 'ok', text: 'Разметка сохранена' });
  };

  const total = activeMs(segments);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 flex-wrap" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Рабочие отрезки</div>
        <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>
          Чистое время упражнений <b style={{ color: 'var(--color-brand)' }}>{mmss(total)}</b> из {mmss(durationMs)}
          {segments.length > 0 ? ` · ${segments.length} отр.` : ''}
        </div>
      </div>

      <div
        ref={barRef}
        onClick={(e) => {
          if (dragRef.current) return;
          onSeek(msFromClientX(e.clientX));
        }}
        style={{
          position: 'relative',
          height: BAR_H,
          borderRadius: 8,
          background: 'var(--color-night)',
          border: '1px solid var(--border-hairline)',
          cursor: 'pointer',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {segments.map((s, i) => (
          <div
            key={`${s.startMs}-${i}`}
            title={`${mmss(s.startMs)} — ${mmss(s.endMs)}`}
            style={{
              position: 'absolute',
              left: pct(s.startMs),
              width: pct(s.endMs - s.startMs),
              top: 0,
              bottom: 0,
              background: 'rgba(161,255,74,0.30)',
              borderLeft: '2px solid var(--color-brand)',
              borderRight: '2px solid var(--color-brand)',
            }}
          >
            {(['start', 'end'] as const).map((edge) => (
              <button
                key={edge}
                type="button"
                aria-label={`${edge === 'start' ? 'Начало' : 'Конец'} отрезка ${mmss(edge === 'start' ? s.startMs : s.endMs)}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dragRef.current = { index: i, edge };
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  [edge === 'start' ? 'left' : 'right']: -6,
                  top: 0,
                  bottom: 0,
                  width: 12,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'col-resize',
                  padding: 0,
                }}
              />
            ))}
          </div>
        ))}
        {/* Текущий момент видео */}
        <div style={{ position: 'absolute', left: pct(currentMs), top: 0, bottom: 0, width: 2, background: '#F9F8FE', pointerEvents: 'none' }} />
      </div>

      <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
        Зелёным — упражнение, тёмным — объяснения и паузы: их оценка учитывать не будет. Тяните края отрезка, чтобы
        поправить границы; клик по полосе перематывает видео.
      </div>

      {msg && (
        <div
          role="status"
          style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: msg.type === 'ok' ? 'var(--color-brand)' : 'var(--color-danger)' }}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
        <AdminButton type="button" size="sm" icon={Check} disabled={!dirty || saving} onClick={save}>
          {saving ? 'Сохраняю…' : 'Сохранить разметку'}
        </AdminButton>
        <AdminButton type="button" size="sm" tone="secondary" icon={Plus} onClick={addAtPlayhead}>
          Добавить отрезок
        </AdminButton>
        <AdminButton type="button" size="sm" tone="secondary" icon={Trash2} onClick={removeAtPlayhead}>
          Убрать отрезок
        </AdminButton>
        {onAuto && (
          <AdminButton
            type="button"
            size="sm"
            tone="secondary"
            icon={RotateCcw}
            onClick={() => {
              setSegments(onAuto());
              setMsg(null);
            }}
          >
            Разметить автоматически
          </AdminButton>
        )}
        {dirty && (
          <AdminButton type="button" size="sm" tone="secondary" icon={Undo2} disabled={saving} onClick={() => setSegments(saved)}>
            Отменить правки
          </AdminButton>
        )}
      </div>
    </div>
  );
}
