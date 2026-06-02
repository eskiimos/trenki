'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export interface PickerVideo {
  id: string;
  title: string;
  thumbnail?: string | null;
  duration: number; // seconds
  trainer?: { id: string; name: string; lastName?: string | null } | null;
}

interface Props {
  /** Подпись слота: РАЗМИНКА / ФИЗПОДГОТОВКА / ТЕХНИКА / ЗАМИНКА */
  slotLabel: string;
  /** Текущий videoId или '' если ничего не выбрано */
  value: string;
  /** Кандидаты, отфильтрованные по moduleType слота */
  options: PickerVideo[];
  /** Передать '' если очищаем */
  onChange: (videoId: string) => void;
}

function formatDuration(sec: number): string {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return `${m} мин`;
}

function trainerName(t?: PickerVideo['trainer']): string {
  if (!t) return '';
  return `${t.name}${t.lastName ? ' ' + t.lastName : ''}`.trim();
}

export default function VideoSlotPicker({ slotLabel, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? options.find((v) => v.id === value) ?? null : null;

  // Запрещаем body scroll пока открыт sheet
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Триггер-карточка */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left transition-transform duration-100 active:scale-[0.98]"
        style={{
          background: '#101530',
          border: selected ? '1px solid rgba(161, 255, 74, 0.30)' : '1px dashed #26252F',
          borderRadius: 10,
          padding: selected ? 8 : '14px 12px',
          cursor: 'pointer',
        }}
      >
        {selected ? (
          <div className="flex gap-3 items-center">
            <div
              className="relative rounded-md overflow-hidden bg-[#060919] shrink-0"
              style={{ width: 76, height: 44 }}
            >
              {selected.thumbnail && (
                <Image
                  src={selected.thumbnail}
                  alt={selected.title}
                  fill
                  className="object-cover"
                  sizes="76px"
                />
              )}
              <div
                className="absolute"
                style={{
                  right: 4,
                  bottom: 3,
                  background: 'rgba(6, 9, 25, 0.85)',
                  color: '#F9F8FE',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 4,
                }}
              >
                {formatDuration(selected.duration)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-overpass"
                style={{ color: '#F9F8FE', fontSize: 13, fontWeight: 700, lineHeight: '120%', wordBreak: 'break-word' }}
              >
                {selected.title}
              </div>
              {selected.trainer && (
                <div
                  className="font-overpass"
                  style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 700, marginTop: 3 }}
                >
                  {trainerName(selected.trainer)}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className="font-overpass"
            style={{ color: '#AEABBB', fontSize: 13, textAlign: 'left' }}
          >
            — нажми чтобы выбрать видео или пропустить —
          </div>
        )}
      </button>

      {open && (
        <div
          className="animate-fadeIn"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(6, 9, 25, 0.85)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            className="animate-slideUp"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#101530',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              width: '100%',
              maxWidth: 560,
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Хэндл */}
            <div className="flex justify-center pt-3 pb-2">
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: '#26252F',
                }}
              />
            </div>

            {/* Шапка */}
            <div className="px-5 pb-3 flex items-center justify-between">
              <div
                className="font-overpass uppercase"
                style={{ color: '#A1FF4A', fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}
              >
                {slotLabel}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-overpass"
                style={{
                  background: 'transparent',
                  color: '#AEABBB',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  padding: '0 4px',
                  lineHeight: 1,
                }}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* Действие «Пропустить» */}
            <div className="px-5 pb-2">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full font-overpass"
                style={{
                  background: value ? 'transparent' : 'rgba(161, 255, 74, 0.12)',
                  color: value ? '#AEABBB' : '#A1FF4A',
                  border: value ? '1px solid #26252F' : '1px solid rgba(161, 255, 74, 0.35)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                — пропустить этот модуль —
              </button>
            </div>

            {/* Список */}
            <div
              className="px-5 pb-6"
              style={{ overflowY: 'auto', flex: 1, paddingTop: 4 }}
            >
              {options.length === 0 ? (
                <div
                  className="text-center py-10 font-overpass"
                  style={{ color: '#AEABBB', fontSize: 13 }}
                >
                  Нет подходящих видео в каталоге
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {options.map((v) => {
                    const isSel = v.id === value;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          onChange(v.id);
                          setOpen(false);
                        }}
                        className="text-left"
                        style={{
                          background: '#060919',
                          border: isSel ? '1px solid #A1FF4A' : '1px solid #26252F',
                          borderRadius: 12,
                          padding: 8,
                          display: 'flex',
                          gap: 10,
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          className="relative rounded-md overflow-hidden bg-[#101530] shrink-0"
                          style={{ width: 92, height: 52 }}
                        >
                          {v.thumbnail && (
                            <Image
                              src={v.thumbnail}
                              alt={v.title}
                              fill
                              className="object-cover"
                              sizes="92px"
                            />
                          )}
                          <div
                            className="absolute"
                            style={{
                              right: 4,
                              bottom: 3,
                              background: 'rgba(6, 9, 25, 0.85)',
                              color: '#F9F8FE',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '1px 4px',
                              borderRadius: 4,
                            }}
                          >
                            {formatDuration(v.duration)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-overpass"
                            style={{
                              color: '#F9F8FE',
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: '120%',
                            }}
                          >
                            {v.title}
                          </div>
                          {v.trainer && (
                            <div
                              className="font-overpass"
                              style={{
                                color: '#A1FF4A',
                                fontSize: 11,
                                fontWeight: 700,
                                marginTop: 3,
                              }}
                            >
                              {trainerName(v.trainer)}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
