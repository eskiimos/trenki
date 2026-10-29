'use client';

// Таймлайн рабочих отрезков эталона: зелёным — упражнение, тёмным — объяснения
// и паузы (в оценке не учитываются). Границы двигаются мышью, отрезок можно
// добавить и удалить по текущему моменту видео, автоматику — пересчитать.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flag, Plus, RotateCcw, Trash2, Undo2, X } from 'lucide-react';
import { AdminButton, inputStyle } from '@/components/admin/ui';
import { activeMs, MAX_SEGMENTS, parseSegments, type Segment } from '@/lib/pose/segments';
import { assessmentPreset, ASSESSMENT_PROFILES } from '@/lib/pose/assessment-settings';
import { editSegmentRange, formatSegmentTime, MIN_SEGMENT_MS, moveSegmentBoundary, parseSegmentTime } from '@/lib/pose/segment-editor';
import AssessmentSettingsEditor from './AssessmentSettingsEditor';

const BAR_H = 44;
/** Default length for the manual input form only. Playback markers capture both clicks. */
const NEW_SEGMENT_MS = 5000;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Drag = { index: number; edge: 'start' | 'end'; pointerId: number };

export default function SegmentTimeline({
  durationMs,
  initial,
  currentMs,
  getCurrentMs,
  playbackReady,
  onSeek,
  onSave,
  onAuto,
  onChange,
}: {
  durationMs: number;
  initial: Segment[];
  currentMs: number;
  /** Read the player at the click itself; rendered time may lag behind a recent seek. */
  getCurrentMs: () => number | null;
  playbackReady: boolean;
  onSeek: (ms: number) => void;
  onSave: (segments: Segment[]) => Promise<string | null>;
  /** Пересчитать автоматически по кадрам эталона (null — кадры ещё не загружены). */
  onAuto: (() => Segment[]) | null;
  /** Preview edits without replacing the saved initial value. */
  onChange?: (segments: Segment[]) => void;
}) {
  const [segments, setSegments] = useState<Segment[]>(initial);
  const [saved, setSaved] = useState<Segment[]>(initial);
  const [saving, setSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [activeDrag, setActiveDrag] = useState<Drag | null>(null);
  const [manualNew, setManualNew] = useState(false);
  const [startText, setStartText] = useState<string | null>(null);
  const [endText, setEndText] = useState<string | null>(null);
  const [pendingStartMs, setPendingStartMs] = useState<number | null>(null);
  const [repeatSeekText, setRepeatSeekText] = useState<string | null>(null);
  const changeRef = useRef(onChange);
  useEffect(() => { changeRef.current = onChange; }, [onChange]);
  useEffect(() => { changeRef.current?.(segments); }, [segments]);
  const resetInput = () => { setManualNew(false); setStartText(null); setEndText(null); setRepeatSeekText(null); setMsg(null); };

  useEffect(() => {
    setSegments(initial);
    setSaved(initial);
    setSelectedIndex(0);
    setManualNew(false);
    setStartText(null);
    setEndText(null);
    setPendingStartMs(null);
    setRepeatSeekText(null);
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
      if (!drag || e.pointerId !== drag.pointerId) return;
      e.preventDefault();
      const ms = Math.round(msFromClientX(e.clientX));
      setSegments((prev) => moveSegmentBoundary(prev, drag.index, drag.edge, ms, durationMs));
    };
    const up = (e: PointerEvent) => {
      if (dragRef.current?.pointerId === e.pointerId) {
        dragRef.current = null;
        setActiveDrag(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  const indexAt = (ms: number) => segments.findIndex((s) => ms >= s.startMs && ms < s.endMs);

  const markAtPlayhead = () => {
    const position = getCurrentMs();
    if (position === null) {
      setMsg({ type: 'err', text: 'Дождитесь загрузки видео, чтобы отметить время.' });
      return;
    }
    const time = Math.round(position);
    if (pendingStartMs === null) {
      const existing = indexAt(time);
      if (existing >= 0) {
        setSelectedIndex(existing);
        setMsg({ type: 'err', text: 'В этом месте уже есть рабочий отрезок. Выберите паузу или поправьте его границы.' });
        return;
      }
      if (time > durationMs - MIN_SEGMENT_MS || segments.length >= MAX_SEGMENTS) {
        setMsg({ type: 'err', text: segments.length >= MAX_SEGMENTS ? `Можно добавить не больше ${MAX_SEGMENTS} отрезков.` : 'До конца видео должно оставаться минимум 0,5 секунды.' });
        return;
      }
      resetInput();
      setPendingStartMs(time);
      return;
    }
    const result = editSegmentRange(segments, null, pendingStartMs, time, durationMs);
    if (result.error) { setMsg({ type: 'err', text: result.error }); return; }
    if ('segments' in result) {
      setSegments(result.segments);
      setSelectedIndex(result.selectedIndex);
      setPendingStartMs(null);
      resetInput();
    }
  };

  const removeAtPlayhead = () => {
    resetInput();
    const i = indexAt(getCurrentMs() ?? currentMs);
    if (i < 0) {
      setMsg({ type: 'err', text: 'Поставьте видео на отрезок, который надо убрать' });
      return;
    }
    setSegments(segments.filter((_, idx) => idx !== i));
    setMsg(null);
  };

  const save = async () => {
    const normalized = parseSegments(segments, durationMs);
    if (!normalized) return;
    setSaving(true);
    setMsg(null);
    let error: string | null;
    try { error = await onSave(normalized); } catch { error = 'Не удалось сохранить разметку'; }
    setSaving(false);
    if (error) {
      setMsg({ type: 'err', text: error });
      return;
    }
    setSegments(normalized);
    setSaved(normalized);
    setSelectedIndex(Math.max(0, normalized.findIndex((s) => selectedSegment && s.startMs <= selectedSegment.startMs && s.endMs >= selectedSegment.endMs)));
    setMsg({ type: 'ok', text: 'Разметка сохранена' });
  };

  const total = activeMs(segments.filter((segment) => segment.assessment?.enabled !== false));
  const valid = parseSegments(segments, durationMs) !== null;
  const selected = Math.min(selectedIndex, segments.length - 1);
  const selectedSegment = segments[selected];
  const repeatSeekValue = repeatSeekText ?? formatSegmentTime(selectedSegment?.repeat?.seekToMs ?? Math.max(0, (selectedSegment?.startMs ?? 0) - 15000));
  const repeatSeekMs = parseSegmentTime(repeatSeekValue);
  const repeatInputInvalid = selectedSegment?.repeat?.enabled === true && (repeatSeekMs === null || repeatSeekMs > selectedSegment.startMs);
  useEffect(() => { setRepeatSeekText(null); }, [selected]);
  const startValue = startText ?? formatSegmentTime(selectedSegment?.startMs ?? 0);
  const endValue = endText ?? formatSegmentTime(selectedSegment?.endMs ?? 0);
  const pendingInput = manualNew || startValue !== formatSegmentTime(selectedSegment?.startMs ?? 0) || endValue !== formatSegmentTime(selectedSegment?.endMs ?? 0);
  const applyRange = () => {
    const start = parseSegmentTime(startValue);
    const end = parseSegmentTime(endValue);
    if (start === null || end === null) { setMsg({ type: 'err', text: 'Введите время как 1:23.500 или в секундах: 83,5.' }); return; }
    const result = editSegmentRange(segments, manualNew ? null : selected, start, end, durationMs);
    if (result.error) { setMsg({ type: 'err', text: result.error }); return; }
    if ('segments' in result) {
      setSegments(result.segments);
      setSelectedIndex(result.selectedIndex);
      resetInput();
    }
  };

  return (
    <fieldset disabled={saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Рабочие отрезки</div>
        <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>
          Время биомеханики <b style={{ color: 'var(--color-brand)' }}>{mmss(total)}</b> из {mmss(durationMs)}
          {segments.length > 0 ? ` · ${segments.length} отр.` : ''}
        </div>
      </div>

      <div
        ref={barRef}
        onClick={(e) => {
          if (saving || dragRef.current) return;
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
            key={i}
            title={`${formatSegmentTime(s.startMs)} — ${formatSegmentTime(s.endMs)}`}
            style={{
              position: 'absolute',
              left: pct(s.startMs),
              width: pct(s.endMs - s.startMs),
              top: 0,
              bottom: 0,
              background: s.assessment?.enabled === false ? 'rgba(255,255,255,0.08)' : 'rgba(161,255,74,0.30)',
              borderLeft: `2px solid ${s.assessment?.enabled === false ? 'var(--color-muted)' : 'var(--color-brand)'}`,
              borderRight: `2px solid ${s.assessment?.enabled === false ? 'var(--color-muted)' : 'var(--color-brand)'}`,
            }}
          >
            {(['start', 'end'] as const).map((edge) => (
              <button
                key={edge}
                type="button"
                disabled={pendingStartMs !== null}
                role="slider"
                aria-label={`${edge === 'start' ? 'Начало' : 'Конец'} отрезка ${i + 1}`}
                aria-valuemin={edge === 'start' ? Math.max(segments[i - 1]?.endMs ?? 0, s.repeat?.seekToMs ?? 0) : s.startMs + MIN_SEGMENT_MS}
                aria-valuemax={edge === 'start' ? s.endMs - MIN_SEGMENT_MS : segments[i + 1]?.startMs ?? durationMs}
                aria-valuenow={edge === 'start' ? s.startMs : s.endMs}
                aria-valuetext={formatSegmentTime(edge === 'start' ? s.startMs : s.endMs)}
                onPointerDown={(e) => {
                  if (saving || !e.isPrimary || e.button !== 0) return;
                  e.stopPropagation();
                  e.preventDefault();
                  resetInput();
                  setSelectedIndex(i);
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragRef.current = { index: i, edge, pointerId: e.pointerId };
                  setActiveDrag(dragRef.current);
                }}
                onKeyDown={(e) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                  e.preventDefault();
                  resetInput();
                  setSelectedIndex(i);
                  const value = edge === 'start' ? s.startMs : s.endMs;
                  const next = e.key === 'Home' ? 0 : e.key === 'End' ? durationMs : value + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1000 : 100);
                  setSegments((prev) => moveSegmentBoundary(prev, i, edge, next, durationMs));
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
        {pendingStartMs !== null && <div aria-hidden="true" style={{ position: 'absolute', left: pct(pendingStartMs), width: pct(Math.max(0, currentMs - pendingStartMs)), top: 0, bottom: 0, border: '2px dashed var(--color-brand)', background: 'rgba(161,255,74,0.12)', pointerEvents: 'none' }} />}
        {/* Текущий момент видео */}
        <div style={{ position: 'absolute', left: pct(currentMs), top: 0, bottom: 0, width: 2, background: '#F9F8FE', pointerEvents: 'none' }} />
      </div>

      {pendingStartMs !== null && <div data-testid="pending-segment" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--color-brand)' }}>
        <b>Начало отмечено: {formatSegmentTime(pendingStartMs)}</b>
        <div>Текущее время {formatSegmentTime(currentMs)} · Длительность {formatSegmentTime(Math.max(0, currentMs - pendingStartMs))}</div>
        <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>Посмотрите видео или перемотайте до конца упражнения и нажмите «Закончить отрезок». Затем сохраните разметку.</div>
      </div>}

      {pendingStartMs === null && selectedSegment && <div data-testid="segment-boundaries" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: activeDrag ? 'var(--color-brand)' : 'var(--color-ink)' }}>
        <b>Отрезок {selected + 1}{activeDrag ? ` · перемещаем ${activeDrag.edge === 'start' ? 'начало' : 'конец'}` : ''}</b>
        <div>Начало {formatSegmentTime(selectedSegment.startMs)} · Конец {formatSegmentTime(selectedSegment.endMs)} · Длительность {formatSegmentTime(selectedSegment.endMs - selectedSegment.startMs)}</div>
      </div>}

      <div style={{ color: 'var(--color-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
        Зелёным — упражнение с оценкой, серым — отрезок без биомеханики; тёмным — объяснения и паузы. Тяните края отрезка, чтобы
        поправить границы; клик по полосе перематывает видео.
      </div>

      {msg && (
        <div
          role={msg.type === 'err' ? 'alert' : 'status'}
          style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: msg.type === 'ok' ? 'var(--color-brand)' : 'var(--color-danger)' }}
        >
          {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
        <AdminButton type="button" size="sm" icon={pendingStartMs === null ? Plus : Flag} disabled={!playbackReady || pendingInput || !!activeDrag} onClick={markAtPlayhead}>
          {pendingStartMs === null ? 'Начать отрезок' : 'Закончить отрезок'}
        </AdminButton>
        {pendingStartMs !== null && <AdminButton type="button" size="sm" tone="secondary" icon={X} onClick={() => { setPendingStartMs(null); setMsg(null); }}>Отменить начало</AdminButton>}
        <AdminButton type="button" size="sm" icon={Check} disabled={!dirty || saving || !valid || pendingInput || !!activeDrag || pendingStartMs !== null || repeatInputInvalid} onClick={save}>
          {saving ? 'Сохраняю…' : 'Сохранить разметку'}
        </AdminButton>
        <AdminButton type="button" size="sm" tone="secondary" icon={Plus} disabled={pendingStartMs !== null} onClick={() => {
          resetInput();
          const start = Math.max(0, Math.min(Math.round(getCurrentMs() ?? currentMs), durationMs - MIN_SEGMENT_MS));
          setStartText(formatSegmentTime(start));
          setEndText(formatSegmentTime(Math.min(durationMs, start + NEW_SEGMENT_MS)));
          setManualNew(true);
        }}>Ввести отрезок</AdminButton>
        <AdminButton type="button" size="sm" tone="secondary" icon={Trash2} disabled={pendingStartMs !== null} onClick={removeAtPlayhead}>
          Убрать отрезок
        </AdminButton>
        {onAuto && (
          <AdminButton
            type="button"
            size="sm"
            tone="secondary"
            icon={RotateCcw}
            disabled={pendingStartMs !== null}
            onClick={() => {
              resetInput();
              setSelectedIndex(0);
              setSegments(onAuto());
              setMsg(null);
            }}
          >
            Разметить автоматически
          </AdminButton>
        )}
        {dirty && (
          <AdminButton type="button" size="sm" tone="secondary" icon={Undo2} disabled={saving || pendingStartMs !== null} onClick={() => { resetInput(); setSegments(saved); setSelectedIndex(0); }}>
            Отменить правки
          </AdminButton>
        )}
      </div>
      {pendingStartMs === null && (selectedSegment || manualNew) && <div style={{ marginTop: 20, borderTop: '1px solid var(--border-hairline)', paddingTop: 16 }}>
        {selectedSegment && <label style={{ fontSize: 13, fontWeight: 700 }}>Выбранный отрезок
          <select aria-label="Настройки оценки отрезка" value={selected} style={{ ...inputStyle, margin: '6px 0 12px' }} onChange={(e) => { resetInput(); setSelectedIndex(Number(e.target.value)); }}>
            {segments.map((segment, index) => <option key={index} value={index}>
              {index + 1}. {formatSegmentTime(segment.startMs)} — {formatSegmentTime(segment.endMs)} · {segment.assessment?.enabled === false ? 'Без биомеханики' : ASSESSMENT_PROFILES[segment.assessment?.profile ?? 'balanced']}
            </option>)}
          </select>
        </label>}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{manualNew ? 'Новый отрезок вручную' : 'Границы отрезка вручную'}</div>
        <div className="flex flex-wrap gap-3">
          <label style={{ flex: '1 1 140px', fontSize: 13 }}>Начало отрезка
            <input type="text" inputMode="decimal" value={startValue} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => { setStartText(e.target.value); setMsg(null); }} />
          </label>
          <label style={{ flex: '1 1 140px', fontSize: 13 }}>Конец отрезка
            <input type="text" inputMode="decimal" value={endValue} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => { setEndText(e.target.value); setMsg(null); }} />
          </label>
        </div>
        <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>Минуты:секунды, например 1:23.500, или секунды: 83,5. Минимальная длительность — 0,5 секунды.</p>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
          <AdminButton type="button" size="sm" tone="secondary" onClick={applyRange} disabled={!pendingInput}>{manualNew ? 'Добавить вручную' : 'Применить границы'}</AdminButton>
          {pendingInput && <AdminButton type="button" size="sm" tone="secondary" onClick={resetInput}>Отменить ввод</AdminButton>}
        </div>
        {pendingInput && <p role="status" style={{ color: 'var(--color-muted)', fontSize: 12 }}>Примените границы или отмените ввод, затем сохраните разметку.</p>}
        {selectedSegment && !manualNew && <AssessmentSettingsEditor key={selected} value={selectedSegment.assessment ?? assessmentPreset()} onChange={(assessment) => {
          setSegments((prev) => prev.map((segment, index) => index === selected ? { ...segment, assessment } : segment));
          setMsg(null);
        }} />}
        {selectedSegment && !manualNew && <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-hairline)' }}>
          <label className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, minHeight: 44 }}>
            <input aria-label="Предлагать повтор подхода" type="checkbox" checked={selectedSegment.repeat?.enabled === true}
              disabled={selectedSegment.assessment?.enabled === false}
              style={{ appearance: 'auto', WebkitAppearance: 'checkbox', width: 20, height: 20, accentColor: 'var(--color-brand)' }}
              onChange={(e) => {
                const repeat = selectedSegment.repeat ?? { enabled: true, seekToMs: Math.max(0, selectedSegment.startMs - 15000), promptDelayMs: 7000, promptDurationMs: 5000 };
                setSegments((previous) => previous.map((segment, index) => index === selected ? { ...segment, repeat: { ...repeat, enabled: e.target.checked } } : segment));
                setRepeatSeekText(null); setMsg(null);
              }} /> Предлагать повтор подхода
          </label>
          {selectedSegment.repeat?.enabled && <div className="flex flex-col gap-3" style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13 }}>Вернуться к моменту видео
              <input aria-label="Момент возврата для повтора" type="text" inputMode="decimal" value={repeatSeekValue} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => {
                const value = e.target.value; setRepeatSeekText(value); setMsg(null);
                const seekToMs = parseSegmentTime(value);
                if (seekToMs === null || seekToMs > selectedSegment.startMs) return;
                setSegments((previous) => previous.map((segment, index) => index === selected ? { ...segment, repeat: { ...selectedSegment.repeat!, seekToMs } } : segment));
              }} />
            </label>
            <p style={{ color: 'var(--color-muted)', fontSize: 12, margin: 0 }}>Начало подхода — {formatSegmentTime(selectedSegment.startMs)}. Например, укажите момент за 10–20 секунд до него, чтобы спортсмен успел подготовиться. Формат 1:23.500 или секунды 83,5.</p>
            {repeatInputInvalid && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>Укажите время возврата от начала видео до начала выбранного подхода.</p>}
            <div className="flex flex-wrap gap-3">
              <label style={{ flex: '1 1 160px', fontSize: 13 }}>Предложить через, с
                <input aria-label="Задержка предложения повтора" type="number" min={0} max={30} step={1} value={selectedSegment.repeat.promptDelayMs / 1000} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => {
                  const promptDelayMs = Number(e.target.value) * 1000;
                  setSegments((previous) => previous.map((segment, index) => index === selected ? { ...segment, repeat: { ...selectedSegment.repeat!, promptDelayMs } } : segment)); setMsg(null);
                }} />
              </label>
              <label style={{ flex: '1 1 160px', fontSize: 13 }}>Показывать кнопку, с
                <input aria-label="Время показа предложения повтора" type="number" min={1} max={15} step={1} value={selectedSegment.repeat.promptDurationMs / 1000} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => {
                  const promptDurationMs = Number(e.target.value) * 1000;
                  setSegments((previous) => previous.map((segment, index) => index === selected ? { ...segment, repeat: { ...selectedSegment.repeat!, promptDurationMs } } : segment)); setMsg(null);
                }} />
              </label>
            </div>
          </div>}
          {selectedSegment.assessment?.enabled === false && <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>Повтор не предлагается для теории и отрезков без биомеханики.</p>}
        </div>}
        {!valid && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>
          Проверьте настройки: важность 0–5, хотя бы один обязательный сустав, время возврата не позже начала подхода, задержка 0–30 с и показ 1–15 с. Отрезки с разными настройками не должны пересекаться.
        </p>}
        <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>Сохраните разметку, чтобы применить настройки в тесте. Повторная авторазметка заменяет отрезки и возвращает профиль «Всё тело».</p>
      </div>}
    </fieldset>
  );
}
