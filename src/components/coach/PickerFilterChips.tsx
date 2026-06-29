'use client';

import {
  LOAD_TYPE_LABELS,
  LOAD_TYPE_FILTER_ORDER,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUP_FILTER_ORDER,
} from '@/lib/videoLabels';

interface Props {
  /** Доступные значения (из текущего набора видео) — лишние ряды скрываются */
  availableLoad: string[];
  availableMuscle: string[];
  selectedLoad: string[];
  selectedMuscle: string[];
  onToggleLoad: (v: string) => void;
  onToggleMuscle: (v: string) => void;
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide flex-shrink-0 transition ${
        selected ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#060919] text-[#AEABBB] border border-white/10'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Компактный фильтр по нагрузке и группе мышц для тренерского подбора видео.
 * Каждый ряд — горизонтальный скролл чипов; пустой ряд (нет доступных значений)
 * не рисуется. Порядок и набор опций — по справочнику videoLabels.
 */
export default function PickerFilterChips({
  availableLoad,
  availableMuscle,
  selectedLoad,
  selectedMuscle,
  onToggleLoad,
  onToggleMuscle,
}: Props) {
  const loads = LOAD_TYPE_FILTER_ORDER.filter((k) => availableLoad.includes(k));
  const muscles = MUSCLE_GROUP_FILTER_ORDER.filter((k) => availableMuscle.includes(k));
  if (loads.length === 0 && muscles.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {loads.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {loads.map((k) => (
            <Chip
              key={k}
              label={LOAD_TYPE_LABELS[k] ?? k}
              selected={selectedLoad.includes(k)}
              onClick={() => onToggleLoad(k)}
            />
          ))}
        </div>
      )}
      {muscles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {muscles.map((k) => (
            <Chip
              key={k}
              label={MUSCLE_GROUP_LABELS[k] ?? k}
              selected={selectedMuscle.includes(k)}
              onClick={() => onToggleMuscle(k)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
