'use client';

import { useState } from 'react';
import { ThumbsUp } from 'lucide-react';

interface CircularSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export default function CircularSlider({ value, min, max, onChange }: CircularSliderProps) {
  const [isTextChanging, setIsTextChanging] = useState(false);

  // Тексты для каждого уровня энергии
  const energyLabels: { [key: number]: string } = {
    0: 'ВЫБЕРИ УРОВЕНЬ ЭНЕРГИИ',
    1: 'ЕЛЕ НОГИ ВОЛОЧУ',
    2: 'ОЧЕНЬ УСТАЛ',
    3: 'Я УСТАВШИЙ',
    4: 'НЕМНОГО УСТАЛ',
    5: 'СРЕДНЕНЬКО',
    6: 'НЕПЛОХО СЕБЯ ЧУВСТВУЮ',
    7: 'ЧУВСТВУЮ СЕБЯ ХОРОШО',
    8: 'В ОТЛИЧНОЙ ФОРМЕ',
    9: 'ЧУВСТВУЮ СЕБЯ ОТЛИЧНО',
    10: 'БАТАРЕЙКА ЗАРЯЖЕНА НА 100%',
  };

  const currentLabel = energyLabels[Math.round(value)] || energyLabels[0];
  // «Хорошо» подсвечиваем иконкой вместо эмодзи в тексте
  const showThumbsUp = Math.round(value) === 7;

  const handleValueChange = (newValue: number) => {
    setIsTextChanging(true);
    onChange(newValue);
    setTimeout(() => setIsTextChanging(false), 150);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Текущее значение */}
      <div className="text-center mb-8">
        <div style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '56px',
          color: '#F9F8FE',
          lineHeight: '1',
          transition: 'opacity 0.3s ease-in-out',
          opacity: isTextChanging ? 0 : 1,
        }}>
          {Math.round(value)}/{max}
        </div>
        <div style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '12px',
          color: '#F9F8FE',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginTop: '12px',
          transition: 'opacity 0.3s ease-in-out',
          opacity: isTextChanging ? 0 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          {currentLabel}
          {showThumbsUp && <ThumbsUp size={16} aria-hidden />}
        </div>
      </div>

      {/* Слайдер */}
      <div className="relative mb-6">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => handleValueChange(parseInt(e.target.value))}
          className="w-full appearance-none cursor-pointer"
          style={{
            height: '8px',
            borderRadius: '4px',
            background: `linear-gradient(to right, #445CFF 0%, #445CFF ${(value / max) * 100}%, #2D3748 ${(value / max) * 100}%, #2D3748 100%)`,
            outline: 'none',
          }}
        />
        <style jsx>{`
          input[type='range']::-webkit-slider-thumb {
            appearance: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #667EEA;
            border: 3px solid #fff;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
          input[type='range']::-moz-range-thumb {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #667EEA;
            border: 3px solid #fff;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          }
        `}</style>
        <div className="flex justify-between mt-2 text-xs" style={{ color: '#4A5568' }}>
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      {/* Кнопки быстрого выбора */}
      <div className="grid grid-cols-11 gap-2">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((val) => (
          <button
            key={val}
            onClick={() => handleValueChange(val)}
            className="transition-all duration-200 hover:scale-110"
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: '50%',
              backgroundColor: value === val ? '#445CFF' : '#2D3748',
              color: '#F9F8FE',
              fontFamily: 'Overpass',
              fontWeight: 700,
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              transform: value === val ? 'scale(1.15)' : 'scale(1)',
            }}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}
