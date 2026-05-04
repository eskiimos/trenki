'use client';

import React from 'react';
import {
  MODULE_TYPE_LABELS,
  LOAD_TYPE_LABELS,
  MUSCLE_GROUP_LABELS,
  DIFFICULTY_LABELS,
  DURATION_BUCKETS,
  DurationBucketId,
} from '@/lib/videoLabels';

export interface VideoFilters {
  moduleTypes: string[];
  loadTypes: string[];
  muscleGroups: string[];
  difficulties: string[];
  equipment: string[];
  durations: DurationBucketId[];
}

export const EMPTY_FILTERS: VideoFilters = {
  moduleTypes: [],
  loadTypes: [],
  muscleGroups: [],
  difficulties: [],
  equipment: [],
  durations: [],
};

export function countActiveFilters(f: VideoFilters): number {
  return (
    f.moduleTypes.length +
    f.loadTypes.length +
    f.muscleGroups.length +
    f.difficulties.length +
    f.equipment.length +
    f.durations.length
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: VideoFilters;
  onChange: (next: VideoFilters) => void;
  /** Доступные значения для каждой группы (на основе текущей коллекции видео) */
  available: {
    moduleTypes: string[];
    loadTypes: string[];
    muscleGroups: string[];
    difficulties: string[];
    equipment: string[];
  };
  /** Сколько видео попадает под текущие фильтры — для кнопки */
  matchedCount: number;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function Chip({ label, selected, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="uppercase transition-all duration-150"
      style={{
        height: '40px',
        padding: '10px 16px',
        borderRadius: '32px',
        backgroundColor: selected ? '#A1FF4A' : '#AEABBB1F',
        color: selected ? '#060919' : '#F9F8FE',
        fontFamily: 'Overpass, sans-serif',
        fontWeight: 700,
        fontSize: '13px',
        lineHeight: '120%',
        letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
        border: selected ? 'none' : '1px solid rgba(174,171,187,0.2)',
      }}
    >
      {label}
    </button>
  );
}

interface SectionProps {
  title: string;
  values: string[];
  selected: string[];
  labels?: Record<string, string>;
  onToggle: (v: string) => void;
}

function Section({ title, values, selected, labels, onToggle }: SectionProps) {
  if (values.length === 0) return null;
  return (
    <div className="mb-6">
      <h3
        className="mb-3 uppercase"
        style={{
          fontFamily: 'Overpass, sans-serif',
          fontWeight: 700,
          fontSize: '12px',
          letterSpacing: '0.5px',
          color: '#F9F8FE',
        }}
      >
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <Chip
            key={v}
            label={labels?.[v] ?? v}
            selected={selected.includes(v)}
            onClick={() => onToggle(v)}
          />
        ))}
      </div>
    </div>
  );
}

export default function VideoFiltersModal({
  open,
  onClose,
  filters,
  onChange,
  available,
  matchedCount,
}: Props) {
  if (!open) return null;

  const toggle = <K extends keyof VideoFilters>(key: K, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
    onChange({ ...filters, [key]: next } as VideoFilters);
  };

  const reset = () => onChange(EMPTY_FILTERS);
  const totalActive = countActiveFilters(filters);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#101530] w-full rounded-t-3xl flex flex-col"
        style={{ height: '88vh', maxHeight: '88vh', marginBottom: '69px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pt-5 pb-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="uppercase"
            style={{
              fontFamily: 'Overpass, sans-serif',
              fontWeight: 800,
              fontSize: '14px',
              letterSpacing: '0.5px',
              color: '#F9F8FE',
            }}
          >
            Фильтры
            {totalActive > 0 && (
              <span style={{ color: '#A1FF4A', marginLeft: 8 }}>· {totalActive}</span>
            )}
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={totalActive === 0}
            className="uppercase"
            style={{
              fontFamily: 'Overpass, sans-serif',
              fontWeight: 700,
              fontSize: '12px',
              letterSpacing: '0.5px',
              color: totalActive === 0 ? '#AEABBB66' : '#AEABBB',
              cursor: totalActive === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Сбросить
          </button>
        </div>

        {/* Body */}
        <div
          className="overflow-y-auto px-4 pt-5"
          style={{ overscrollBehavior: 'contain', flex: '1 1 auto', minHeight: 0 }}
        >
          <Section
            title="Тип тренировки"
            values={available.moduleTypes}
            selected={filters.moduleTypes}
            labels={MODULE_TYPE_LABELS}
            onToggle={(v) => toggle('moduleTypes', v)}
          />
          <Section
            title="Тип нагрузки"
            values={available.loadTypes}
            selected={filters.loadTypes}
            labels={LOAD_TYPE_LABELS}
            onToggle={(v) => toggle('loadTypes', v)}
          />
          <Section
            title="Группа мышц"
            values={available.muscleGroups}
            selected={filters.muscleGroups}
            labels={MUSCLE_GROUP_LABELS}
            onToggle={(v) => toggle('muscleGroups', v)}
          />
          <Section
            title="Сложность"
            values={available.difficulties}
            selected={filters.difficulties}
            labels={DIFFICULTY_LABELS}
            onToggle={(v) => toggle('difficulties', v)}
          />
          <Section
            title="Длительность"
            values={DURATION_BUCKETS.map((b) => b.id)}
            selected={filters.durations}
            labels={Object.fromEntries(DURATION_BUCKETS.map((b) => [b.id, b.label]))}
            onToggle={(v) => toggle('durations', v)}
          />
          <Section
            title="Оборудование"
            values={available.equipment}
            selected={filters.equipment}
            onToggle={(v) => toggle('equipment', v)}
          />
        </div>

        {/* Footer */}
        <div
          className="p-4"
          style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: '#101530',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full font-medium uppercase"
            style={{
              backgroundColor: '#A1FF4A',
              color: '#060919',
              fontFamily: 'Overpass, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              letterSpacing: '0.5px',
              height: '56px',
              padding: '0 16px',
            }}
          >
            {matchedCount > 0 ? `Показать ${matchedCount} видео` : 'Ничего не найдено'}
          </button>
        </div>
      </div>
    </div>
  );
}
