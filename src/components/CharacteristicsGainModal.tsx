'use client';

import { useEffect, useState } from 'react';

interface CharacteristicsGainModalProps {
  gains: {
    ratingPower?: number;
    ratingSpeed?: number;
    ratingEndurance?: number;
    ratingTechnique?: number;
    ratingFlexibility?: number;
  };
  newCharacteristics: {
    ratingPower: number;
    ratingSpeed: number;
    ratingEndurance: number;
    ratingTechnique: number;
    ratingFlexibility: number;
    potential: number;
  };
  onClose: () => void;
}

type CharacteristicKey = 'ratingPower' | 'ratingSpeed' | 'ratingEndurance' | 'ratingTechnique' | 'ratingFlexibility';

interface CharacteristicItem {
  key: CharacteristicKey;
  emoji: string;
  label: string;
  color: string;
}

const characteristics: CharacteristicItem[] = [
  { key: 'ratingPower', emoji: '💪', label: 'Сила', color: '#FF6B6B' },
  { key: 'ratingSpeed', emoji: '⚡', label: 'Скорость', color: '#FFD700' },
  { key: 'ratingEndurance', emoji: '🫀', label: 'Выносливость', color: '#A1FF4A' },
  { key: 'ratingTechnique', emoji: '🎯', label: 'Техника', color: '#4ECDC4' },
  { key: 'ratingFlexibility', emoji: '🤸', label: 'Гибкость', color: '#9B59B6' },
];

export default function CharacteristicsGainModal({ 
  gains, 
  newCharacteristics, 
  onClose 
}: CharacteristicsGainModalProps) {
  const [animateIn, setAnimateIn] = useState(false);
  const [showGains, setShowGains] = useState(false);

  useEffect(() => {
    // Анимация появления
    setTimeout(() => setAnimateIn(true), 50);
    
    // Показываем прирост через полсекунды
    setTimeout(() => setShowGains(true), 500);
  }, []);

  // Фильтруем только те характеристики, которые выросли
  const gainedCharacteristics = characteristics.filter(
    char => gains[char.key] && gains[char.key]! > 0
  );

  // Если нет прироста, не показываем модалку
  if (gainedCharacteristics.length === 0) {
    return null;
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        animateIn ? 'bg-black/80 backdrop-blur-sm' : 'bg-black/0'
      }`}
      onClick={onClose}
    >
      <div 
        className={`bg-gradient-to-br from-[#1a1f35] to-[#2d3448] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-[#445CFF]/30 transition-all duration-500 ${
          animateIn ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-white text-xl font-bold font-overpass mb-1">
            Отличная работа!
          </h2>
          <p className="text-[#AEABBB] text-sm font-overpass">
            Ты прокачал свои характеристики
          </p>
        </div>

        {/* Список приростов */}
        <div className="space-y-3 mb-6">
          {gainedCharacteristics.map((char, index) => {
            const gain = gains[char.key]!;
            const newValue = newCharacteristics[char.key];
            
            return (
              <div 
                key={char.key}
                className={`bg-[#1a1f35]/50 rounded-lg p-4 border border-[#445CFF]/20 transition-all duration-500 delay-${index * 100}`}
                style={{
                  transform: showGains ? 'translateX(0)' : 'translateX(-20px)',
                  opacity: showGains ? 1 : 0,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{char.emoji}</span>
                    <span className="text-white text-sm font-medium font-overpass">
                      {char.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#AEABBB] text-sm font-overpass">
                      {(newValue - gain).toFixed(1)}
                    </span>
                    <span className="text-[#A1FF4A] text-lg font-bold font-overpass">
                      +{gain.toFixed(1)}
                    </span>
                    <span className="text-white text-lg font-bold font-overpass">
                      {newValue.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                {/* Прогресс-бар */}
                <div className="h-2 bg-[#0d111f] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ 
                      width: showGains ? `${Math.min(100, newValue)}%` : `${Math.min(100, newValue - gain)}%`,
                      backgroundColor: char.color
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Новый потенциал */}
        <div className="bg-gradient-to-r from-[#445CFF]/30 to-[#7B61FF]/30 rounded-lg p-4 mb-6 border border-[#445CFF]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span className="text-white text-base font-medium font-overpass">
                Потенциал
              </span>
            </div>
            <span className="text-white text-2xl font-black font-overpass">
              {newCharacteristics.potential.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-[#445CFF] to-[#7B61FF] hover:from-[#5a6fff] hover:to-[#8b71ff] text-white font-bold py-4 rounded-lg transition-all duration-300 shadow-lg font-overpass"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
