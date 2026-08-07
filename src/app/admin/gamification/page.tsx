'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Star } from 'lucide-react';
import {
  computeXp,
  levelFromXp,
  xpForLevel,
  statusFromLevel,
  STATUSES,
} from '@/lib/gamification';

// Админ-песочница геймификации: быстрый прогон XP/уровней/эволюций/стрика БЕЗ
// реальных тренировок. Библиотека чистая — вся математика гоняется на клиенте,
// прод-данные не трогаются. Доступ гейтит middleware (/admin → admin_session).

/** Кумулятивный XP, нужный чтобы ДОСТИЧЬ уровня level. */
const cumulativeXp = (level: number): number => {
  let sum = 0;
  for (let i = 1; i < level; i++) sum += xpForLevel(i);
  return sum;
};

export default function AdminGamificationPage() {
  // Симулятор: вход — счётчики, как в реальном API
  const [workouts, setWorkouts] = useState(10);
  const [modules, setModules] = useState(40);
  const [streak, setStreak] = useState(3);
  // Реальные значения текущего админа
  const [real, setReal] = useState<{ xp: number; level: number; status: { title: string; emoji: string }; streak: number } | null>(null);
  const [flagsMsg, setFlagsMsg] = useState<string | null>(null);
  // Превью модалки эволюции (локальный стейт, НЕ localStorage-механика)
  const [previewStatus, setPreviewStatus] = useState<(typeof STATUSES)[number] | null>(null);

  useEffect(() => {
    fetch('/api/gamification/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReal(d))
      .catch(() => {});
  }, []);

  const xp = computeXp({ completedWorkouts: workouts, completedModules: modules });
  const info = levelFromXp(xp);
  const status = statusFromLevel(info.level);

  // Сброс локальных «показано один раз» флагов — чтобы повторно затестить
  // модалку эволюции, предложение цикла и install-плашку на этом устройстве.
  const resetLocalFlags = () => {
    try {
      localStorage.removeItem('trenki_status_seen');
      localStorage.removeItem('trenki_cycle_offer_shown');
      localStorage.removeItem('trenki_a2hs_seen');
      setFlagsMsg('Флаги сброшены: эволюция, предложение цикла, install-плашка покажутся снова');
    } catch {
      setFlagsMsg('localStorage недоступен');
    }
  };

  const inputCls = 'w-24 bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#A1FF4A]';

  return (
    <div className="min-h-screen bg-[#060919] text-white p-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin" aria-label="Назад"><ChevronLeft size={24} className="text-white" /></Link>
          <h1 className="font-bold uppercase" style={{ fontFamily: 'Overpass', fontSize: 15, letterSpacing: 0.5 }}>
            Геймификация — песочница
          </h1>
        </div>

        {/* Мои реальные значения */}
        <div className="bg-[#101530] rounded-2xl p-4 mb-6">
          <div className="text-[#AEABBB] text-xs uppercase font-bold mb-2" style={{ fontFamily: 'Overpass' }}>Мои реальные значения (из API)</div>
          {real ? (
            <div className="text-sm">
              {real.status.emoji} {real.status.title} · Уровень {real.level} · XP {real.xp} · 🔥 стрик {real.streak}
            </div>
          ) : (
            <div className="text-[#AEABBB] text-sm">Загрузка…</div>
          )}
        </div>

        {/* Симулятор */}
        <div className="bg-[#101530] rounded-2xl p-4 mb-6">
          <div className="text-[#AEABBB] text-xs uppercase font-bold mb-3" style={{ fontFamily: 'Overpass' }}>Симулятор</div>
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="text-xs text-[#AEABBB]">Тренировок<br />
              <input type="number" min={0} value={workouts} onChange={(e) => setWorkouts(Number(e.target.value) || 0)} className={inputCls} />
            </label>
            <label className="text-xs text-[#AEABBB]">Модулей<br />
              <input type="number" min={0} value={modules} onChange={(e) => setModules(Number(e.target.value) || 0)} className={inputCls} />
            </label>
            <label className="text-xs text-[#AEABBB]">Стрик, дней<br />
              <input type="number" min={0} value={streak} onChange={(e) => setStreak(Number(e.target.value) || 0)} className={inputCls} />
            </label>
          </div>

          {/* Рендер «как в профиле» */}
          <div className="bg-[#0B1030] border border-[#26252F] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#A1FF4A]/15 text-[#A1FF4A] text-xs font-bold rounded-full px-3 py-1">
                {status.emoji} {status.title}
              </span>
              <span className="text-white font-bold">Уровень {info.level}</span>
              {streak >= 2 && <span className="text-xs text-[#FF8C4A]">🔥 {streak} дн.</span>}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-[#A1FF4A]" style={{ width: `${(info.xpIntoLevel / info.xpForNext) * 100}%` }} />
            </div>
            <div className="text-[#AEABBB] text-xs">
              XP: {info.xpIntoLevel}/{info.xpForNext} · всего {info.xpTotal}
              {status.nextStatus && <> · следующее звание: {status.nextStatus.title} (ур. {status.nextStatus.minLevel})</>}
            </div>
          </div>
        </div>

        {/* Таблица званий */}
        <div className="bg-[#101530] rounded-2xl p-4 mb-6">
          <div className="text-[#AEABBB] text-xs uppercase font-bold mb-3" style={{ fontFamily: 'Overpass' }}>Звания и пороги</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#AEABBB] text-left text-xs">
                <th className="py-1">Звание</th><th>С уровня</th><th>Нужно XP всего</th><th>≈ тренировок*</th><th></th>
              </tr>
            </thead>
            <tbody>
              {STATUSES.map((s) => {
                const needXp = cumulativeXp(s.minLevel);
                return (
                  <tr key={s.key} className="border-t border-white/10">
                    <td className="py-2">{s.emoji} {s.title}</td>
                    <td>{s.minLevel}</td>
                    <td>{needXp}</td>
                    <td>{Math.ceil(needXp / 180)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setPreviewStatus(s)}
                        className="text-xs bg-[#0A0E1A] border border-[#2a2f4a] rounded-lg px-2 py-1 hover:border-[#A1FF4A]"
                      >
                        модалка
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[#6E6B7B] text-xs mt-2">* при тренировке из 4 модулей (100 + 4×20 = 180 XP)</div>
        </div>

        {/* Сброс локальных флагов */}
        <div className="bg-[#101530] rounded-2xl p-4">
          <div className="text-[#AEABBB] text-xs uppercase font-bold mb-2" style={{ fontFamily: 'Overpass' }}>Повторный тест на этом устройстве</div>
          <button
            type="button"
            onClick={resetLocalFlags}
            className="bg-[#A1FF4A] text-[#060919] font-bold text-sm rounded-lg px-4 py-2"
          >
            Сбросить локальные флаги
          </button>
          {flagsMsg && <div className="text-[#A1FF4A] text-xs mt-2">{flagsMsg}</div>}
          <div className="text-[#6E6B7B] text-xs mt-2">
            Сбрасывает «уже показано»: модалка эволюции (профиль), предложение собрать цикл, плашка «на экран домой».
          </div>
        </div>

        {/* Превью модалки эволюции — копия вёрстки EvolutionModal, без localStorage */}
        {previewStatus && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewStatus(null)} />
            <div className="relative w-full max-w-sm rounded-2xl bg-[#0B1030] border border-[rgba(161,255,74,0.35)] p-6 text-center animate-popIn">
              <div style={{ fontSize: 56 }}>{previewStatus.emoji}</div>
              <div className="text-white text-xl font-bold mt-2">Эволюция!</div>
              <div className="text-white/80 text-sm mt-1">Ты теперь <span className="text-[#A1FF4A] font-semibold">{previewStatus.title}</span></div>
              <button
                type="button"
                onClick={() => setPreviewStatus(null)}
                className="mt-4 w-full rounded-lg bg-[#A1FF4A] px-3 py-2.5 text-sm font-semibold text-[#0B0F2A]"
              >
                Дальше
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
