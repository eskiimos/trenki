'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegram } from '@/hooks/useTelegram';

interface CharacteristicsSummary {
  current: {
    ratingPower: number;
    ratingSpeed: number;
    ratingEndurance: number;
    ratingTechnique: number;
    ratingFlexibility: number;
    potential: number;
  };
  initial: {
    rawPower: number;
    rawSpeed: number;
    rawEndurance: number;
    rawTechnique: number;
    rawFlexibility: number;
    kMastery: number;
  } | null;
  totalGrowth: {
    power: number;
    speed: number;
    endurance: number;
    technique: number;
    flexibility: number;
  };
  totalWorkouts: number;
  totalModules: number;
}

export default function CharacteristicsStatsPage() {
  const router = useRouter();
  const { user, webApp } = useTelegram();
  const [data, setData] = useState<CharacteristicsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (webApp) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(() => router.back());
      
      return () => {
        webApp.BackButton.hide();
      };
    }
  }, [webApp, router]);

  // Сервер берёт userId из httpOnly cookie (requireAuthUser). Раньше гейт
  // `if (user?.id)` зависел от localStorage; на Android/Samsung Fold в PWA
  // localStorage мог быть пустым → loadData не вызывался → бесконечная
  // загрузка.
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Сервер берёт userId из сессии
      const profileResponse = await fetch('/api/profile');
      const profileData = await profileResponse.json();

      if (profileData.user?.profile) {
        const profile = profileData.user.profile;
        
        // Рассчитываем начальные значения (на момент опроса)
        const initial = profile.kMastery && profile.rawPower ? {
          rawPower: profile.rawPower,
          rawSpeed: profile.rawSpeed,
          rawEndurance: profile.rawEndurance,
          rawTechnique: profile.rawTechnique,
          rawFlexibility: profile.rawFlexibility,
          kMastery: profile.kMastery,
        } : null;

        // Начальные рейтинги (raw * k_mastery, ограниченные [20, 75])
        const initialRatings = initial ? {
          power: Math.max(20, Math.min(75, initial.rawPower * initial.kMastery)),
          speed: Math.max(20, Math.min(75, initial.rawSpeed * initial.kMastery)),
          endurance: Math.max(20, Math.min(75, initial.rawEndurance * initial.kMastery)),
          technique: Math.max(20, Math.min(75, initial.rawTechnique * initial.kMastery)),
          flexibility: Math.max(20, Math.min(75, initial.rawFlexibility * initial.kMastery)),
        } : null;

        // Текущие значения
        const current = {
          ratingPower: profile.ratingPower || 0,
          ratingSpeed: profile.ratingSpeed || 0,
          ratingEndurance: profile.ratingEndurance || 0,
          ratingTechnique: profile.ratingTechnique || 0,
          ratingFlexibility: profile.ratingFlexibility || 0,
          potential: profile.potential || 0,
        };

        // Прирост = текущее - начальное
        const totalGrowth = initialRatings ? {
          power: current.ratingPower - initialRatings.power,
          speed: current.ratingSpeed - initialRatings.speed,
          endurance: current.ratingEndurance - initialRatings.endurance,
          technique: current.ratingTechnique - initialRatings.technique,
          flexibility: current.ratingFlexibility - initialRatings.flexibility,
        } : {
          power: current.ratingPower,
          speed: current.ratingSpeed,
          endurance: current.ratingEndurance,
          technique: current.ratingTechnique,
          flexibility: current.ratingFlexibility,
        };

        // Загружаем статистику тренировок
        const statsResponse = await fetch('/api/training/history?limit=1000');
        const statsData = await statsResponse.json();

        setData({
          current,
          initial,
          totalGrowth,
          totalWorkouts: statsData.stats?.totalWorkouts || 0,
          totalModules: profile.modulesToday || 0, // Заглушка, нужна более точная статистика
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#101530] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Загрузка статистики...</p>
        </div>
      </div>
    );
  }

  if (!data || data.current.potential === 0) {
    return (
      <div className="min-h-screen bg-[#101530] text-white p-4 flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold mb-2">Статистика недоступна</h2>
        <p className="text-gray-400 text-center mb-6">
          Пройди стартовый опрос, чтобы начать отслеживать прогресс
        </p>
        <Link href="/onboarding/characteristics">
          <button className="bg-gradient-to-r from-[#445CFF] to-[#7B61FF] px-6 py-3 rounded-lg font-semibold">
            Пройти опрос
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 pb-24" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <h1 className="text-3xl font-bold mb-6">Статистика прогресса</h1>

      {/* Общий прогресс */}
      <div className="bg-gradient-to-r from-[#445CFF] to-[#7B61FF] rounded-xl p-6 mb-6">
        <div className="text-center">
          <p className="text-sm text-white/70 mb-2">Текущий потенциал</p>
          <p className="text-5xl font-black mb-2">{data.current.potential.toFixed(1)}</p>
          <p className="text-sm text-white/80">
            {data.totalWorkouts} тренировок пройдено
          </p>
        </div>
      </div>

      {/* Прирост по характеристикам */}
      <div className="bg-[#1a1f35] rounded-xl p-5 mb-6">
        <h3 className="text-lg font-bold mb-4">📈 Общий прирост</h3>
        <div className="space-y-3">
          <GrowthRow emoji="💪" label="Сила" growth={data.totalGrowth.power} current={data.current.ratingPower} />
          <GrowthRow emoji="⚡" label="Скорость" growth={data.totalGrowth.speed} current={data.current.ratingSpeed} />
          <GrowthRow emoji="🫀" label="Выносливость" growth={data.totalGrowth.endurance} current={data.current.ratingEndurance} />
          <GrowthRow emoji="🎯" label="Техника" growth={data.totalGrowth.technique} current={data.current.ratingTechnique} />
          <GrowthRow emoji="🤸" label="Гибкость" growth={data.totalGrowth.flexibility} current={data.current.ratingFlexibility} />
        </div>
      </div>

      {/* Стартовые данные */}
      {data.initial && (
        <div className="bg-[#1a1f35] rounded-xl p-5 mb-6">
          <h3 className="text-lg font-bold mb-4">🎯 Стартовые показатели</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Коэффициент мастерства (k_mastery)</span>
              <span className="font-bold">{data.initial.kMastery.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Самооценка силы</span>
              <span className="font-bold">{data.initial.rawPower}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Самооценка скорости</span>
              <span className="font-bold">{data.initial.rawSpeed}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Самооценка выносливости</span>
              <span className="font-bold">{data.initial.rawEndurance}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Самооценка техники</span>
              <span className="font-bold">{data.initial.rawTechnique}/10</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Самооценка гибкости</span>
              <span className="font-bold">{data.initial.rawFlexibility}/10</span>
            </div>
          </div>
        </div>
      )}

      {/* Кнопки навигации */}
      <div className="space-y-3">
        <Link href="/training/history">
          <button className="w-full bg-[#2d3448] hover:bg-[#3d4558] text-white py-4 rounded-xl font-semibold transition-colors">
            📋 История тренировок
          </button>
        </Link>
        <Link href="/profile">
          <button className="w-full bg-[#2d3448] hover:bg-[#3d4558] text-white py-4 rounded-xl font-semibold transition-colors">
            👤 Мой профиль
          </button>
        </Link>
      </div>
    </div>
  );
}

// Компонент для строки прироста
const GrowthRow = ({ emoji, label, growth, current }: {
  emoji: string;
  label: string;
  growth: number;
  current: number;
}) => {
  const isPositive = growth > 0;
  const color = isPositive ? '#A1FF4A' : '#FF6B6B';
  
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-xl">{emoji}</span>
        <span className="text-sm text-[#AEABBB]">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span 
          className="font-bold text-sm"
          style={{ color }}
        >
          {isPositive ? '+' : ''}{growth.toFixed(1)}
        </span>
        <span className="text-white font-bold">
          {current.toFixed(1)}
        </span>
      </div>
    </div>
  );
};
