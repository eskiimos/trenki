'use client';

// Модалка ручного подбора модуля при сборке тренировки: поиск по названию +
// фильтр по типу нагрузки. Кандидаты — видео того же типа модуля (эндпоинт
// /api/training/module-candidates). Выбор → /api/training/replace-module {videoId}.

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { LOAD_TYPE_LABELS } from '@/lib/videoLabels';

interface Candidate {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number; // секунды
  loadType: string | null;
  muscleGroup: string | null;
  complexity: string | null;
  trainer: string | null;
  inWorkout: boolean;
}

interface Props {
  sessionId: string;
  moduleIndex: number;
  onClose: () => void;
  onPicked: () => void;
}

export default function ModuleSelectionModal({ sessionId, moduleIndex, onClose, onPicked }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadFilter, setLoadFilter] = useState<string[]>([]);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/training/module-candidates?sessionId=${encodeURIComponent(sessionId)}&moduleIndex=${moduleIndex}&q=${encodeURIComponent(query)}`,
      );
      const d = await res.json().catch(() => ({}));
      setItems(res.ok ? (d.videos || []) : []);
    } finally {
      setLoading(false);
    }
  }, [sessionId, moduleIndex]);

  // Поиск с дебаунсом (сервер фильтрует по названию).
  useEffect(() => {
    const t = setTimeout(() => load(q), 350);
    return () => clearTimeout(t);
  }, [q, load]);

  const loadTypes = Array.from(new Set(items.map((i) => i.loadType).filter(Boolean))) as string[];
  const filtered = loadFilter.length ? items.filter((i) => i.loadType && loadFilter.includes(i.loadType)) : items;
  const toggleLoad = (lt: string) =>
    setLoadFilter((p) => (p.includes(lt) ? p.filter((x) => x !== lt) : [...p, lt]));

  const pick = async (videoId: string) => {
    setBusyId(videoId);
    try {
      const res = await fetch('/api/training/replace-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutSessionId: sessionId, moduleIndex, videoId }),
      });
      if (res.ok) { onPicked(); onClose(); }
      else { const d = await res.json().catch(() => ({})); alert(d?.error || 'Не удалось выбрать'); }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#101530] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold text-base">Выбрать упражнение</h3>
          <button onClick={onClose} className="text-[#AEABBB] hover:text-white text-xl leading-none px-2">×</button>
        </div>

        <div className="p-4 pb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию"
            autoFocus
            className="w-full bg-[#060919] text-white placeholder:text-[#AEABBB] rounded-xl px-4 py-2.5 outline-none border border-white/10 focus:border-[#A1FF4A]/60"
          />
          {loadTypes.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-3" style={{ scrollbarWidth: 'none' }}>
              {loadTypes.map((lt) => (
                <button
                  key={lt}
                  onClick={() => toggleLoad(lt)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition flex-shrink-0 ${loadFilter.includes(lt) ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#060919] text-[#AEABBB] border border-white/10'}`}
                >
                  {LOAD_TYPE_LABELS[lt] || lt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="text-[#AEABBB] text-sm text-center py-8">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="text-[#AEABBB] text-sm text-center py-8">Ничего не найдено</div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((v) => (
                <button
                  key={v.id}
                  onClick={() => pick(v.id)}
                  disabled={busyId !== null}
                  className="flex items-center gap-3 bg-[#060919] rounded-xl p-2.5 text-left hover:bg-white/5 transition disabled:opacity-50"
                >
                  <div className="relative w-[68px] h-[44px] rounded-lg overflow-hidden flex-shrink-0 bg-[#1a1f3a]">
                    {v.thumbnail && (
                      <Image src={v.thumbnail} alt="" fill sizes="68px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-semibold leading-tight line-clamp-2">{v.title}</div>
                    <div className="text-[#AEABBB] text-xs mt-1">
                      {v.trainer ? `${v.trainer} · ` : ''}{Math.max(1, Math.round(v.duration / 60))} мин
                      {v.loadType ? ` · ${LOAD_TYPE_LABELS[v.loadType] || v.loadType}` : ''}
                    </div>
                  </div>
                  {v.inWorkout && <span className="text-[#A1FF4A] text-xs font-bold flex-shrink-0">в плане</span>}
                  {busyId === v.id && <span className="text-[#AEABBB] text-xs flex-shrink-0">…</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
