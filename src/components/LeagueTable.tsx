'use client';

// Лига: свернутая по умолчанию секция, при раскрытии тянет данные с endpoint.
// Используется в родительском кабинете (/api/parent/league?childId=, default)
// и в профиле спортсмена (endpoint='/api/league'). Чужие дети — «Имя Ф.»
// (приватность, полной фамилии нет), свой — по имени с lime-подсветкой строки.

import { useState } from 'react';
import { Trophy, Flame } from 'lucide-react';
import { leagueIconKeyToIcon } from '@/components/gamification/icons';

interface LeagueRow {
  rank: number;
  name: string;
  /** Ключ иконки-аватара (см. @/lib/league); UI мапит его на lucide */
  icon: string;
  weeklyXp: number;
  isOwn: boolean;
  isFake: boolean;
}

interface LeagueResponse {
  noBirthYear?: boolean;
  league?: {
    rows: LeagueRow[];
    ownRank: number;
    totalReal: number;
    percentile: number;
  } | null;
  weekLabel?: string;
  year?: number;
}

interface LeagueTableProps {
  /** Ребёнок в родительском кабинете; не нужен, если задан endpoint */
  childId?: string;
  /** URL источника данных; default — родительский эндпоинт с childId */
  endpoint?: string;
  /** Текст при отсутствии даты рождения (в профиле — без «ребёнка») */
  noBirthYearText?: string;
}

export default function LeagueTable({
  childId,
  endpoint,
  noBirthYearText = 'Укажи дату рождения в профиле ребёнка, чтобы участвовать в лиге.',
}: LeagueTableProps) {
  const url = endpoint ?? `/api/parent/league?childId=${encodeURIComponent(childId ?? '')}`;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LeagueResponse | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    // Данные грузим один раз при первом раскрытии; после ошибки
    // повторное раскрытие пробует снова (data остаётся null)
    if (!next || data || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('league fetch failed');
      const json: LeagueResponse = await res.json();
      setData(json);
    } catch {
      setError('Не удалось загрузить лигу. Раскрой ещё раз, чтобы повторить.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-white/5 p-3 mt-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-muted text-[11px] font-overpass uppercase tracking-wide inline-flex items-center gap-1.5">
          <Trophy size={13} aria-hidden />
          Лига{data?.year ? ` ${data.year} года` : ''}
        </span>
        <span className="text-muted text-xs" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="mt-2">
          {loading && <div className="text-muted text-xs py-2">Загружаем таблицу…</div>}

          {error && <p className="text-red-400 text-xs py-1">{error}</p>}

          {data?.noBirthYear && (
            <p className="text-muted text-xs leading-relaxed py-1">{noBirthYearText}</p>
          )}

          {data && !data.noBirthYear && !data.league && !loading && (
            <p className="text-muted text-xs py-1">Таблица пока недоступна. Зайди позже.</p>
          )}

          {data?.league && (
            <>
              <div className="flex flex-col gap-0.5">
                {data.league.rows.map((row) => {
                  const RowIcon = leagueIconKeyToIcon(row.icon);
                  return (
                  <div
                    key={`${row.rank}-${row.name}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                      row.isOwn ? 'bg-brand/15 text-brand font-bold' : 'text-white'
                    }`}
                  >
                    <span
                      className={`w-6 shrink-0 text-right font-overpass tabular-nums ${
                        row.isOwn ? 'text-brand' : 'text-muted'
                      }`}
                    >
                      {row.rank}
                    </span>
                    <RowIcon size={16} className="shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    <span
                      className={`shrink-0 font-overpass tabular-nums ${
                        row.isOwn ? 'text-brand' : 'text-muted'
                      }`}
                    >
                      {row.weeklyXp} XP
                    </span>
                  </div>
                  );
                })}
              </div>
              <div className="text-muted text-xs mt-2 flex items-center gap-1 flex-wrap">
                <span>Сильнее {data.league.percentile}% сверстников · неделя {data.weekLabel} ·</span>
                <Flame size={12} aria-hidden />
                <span>серия 3+ дней = опыт ×2</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
