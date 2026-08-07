'use client';

// Модалка «Эволюция!» — празднуем смену статуса (Новичок → Перспектива и т.д.).
// Сравнивает текущий status.key с localStorage 'trenki_status_seen': показываем
// только если ключ ИЗМЕНИЛСЯ и в localStorage уже что-то лежало (при самом
// первом визите молчим — иначе каждый новый юзер получал бы «эволюцию» в
// «Новичка»). После показа (или первого визита) запоминаем новый ключ.

import { useEffect, useState } from 'react';

const SEEN_KEY = 'trenki_status_seen';

interface Props {
  statusKey: string;
  title: string;
  emoji: string;
}

const EvolutionModal = ({ statusKey, title, emoji }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!statusKey) return;
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen && seen !== statusKey) {
        setOpen(true); // ключ пишем по кнопке «Дальше», чтобы не потерять показ при уходе со страницы
      } else if (!seen) {
        localStorage.setItem(SEEN_KEY, statusKey); // первый визит — просто запоминаем
      }
    } catch {}
  }, [statusKey]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, statusKey);
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Эволюция"
    >
      <div className="animate-popIn bg-surface rounded-2xl p-8 w-full max-w-sm text-center">
        <div className="text-6xl mb-4" aria-hidden>{emoji}</div>
        <div className="text-white text-xl font-bold mb-2">Эволюция!</div>
        <div className="text-muted text-base mb-6">
          Ты теперь <span className="text-brand font-bold">{title}</span>
        </div>
        <button
          type="button"
          onClick={close}
          className="w-full bg-brand text-night font-bold font-overpass uppercase rounded-full py-3 transition-transform active:scale-95"
        >
          Дальше
        </button>
      </div>
    </div>
  );
};

export default EvolutionModal;
