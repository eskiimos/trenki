'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface GapAnalysis {
  moduleType: string;
  loadType: string;
  muscleGroup?: string;
  status: string;
  priority: number;
  reason: string;
  currentCount: number;
  recommendedCount: number;
}

interface Stats {
  total: number;
  byModule: {
    FITNESS: number;
    WARMUP: number;
    COOLDOWN: number;
    TECHNIQUE: number;
  };
  byStatus: {
    RECOVERY: number;
    DEVELOPMENT: number;
    PEAK: number;
  };
  criticalGaps: number;
  importantGaps: number;
  desirableGaps: number;
}

interface ContentCheckResult {
  success: boolean;
  stats: Stats;
  topPriorities: GapAnalysis[];
  allGaps: GapAnalysis[];
}

// Красивые названия для enum значений
const MODULE_LABELS: Record<string, string> = {
  FITNESS: '💪 ОФП',
  WARMUP: '🤸 Разминка',
  COOLDOWN: '🧘 Заминка',
  TECHNIQUE: '⚡ Техника',
};

const LOAD_TYPE_LABELS: Record<string, string> = {
  AGILITY: 'Ловкость',
  SPEED: 'Скорость',
  POWER: 'Мощность',
  MAX_STRENGTH: 'Максимальная сила',
  STRENGTH_ENDURANCE: 'Силовая выносливость',
  ANAEROBIC_ENDURANCE: 'Анаэробная выносливость',
  AEROBIC_ENDURANCE: 'Аэробная выносливость',
  MOBILITY: 'Мобильность',
  TECHNICAL_SKILL: 'Техническое мастерство',
  STATIC_STRETCH: 'Статическая растяжка',
  DYNAMIC_STRETCH: 'Динамическая растяжка',
  PREHAB: 'Профилактика травм',
};

const MUSCLE_GROUP_LABELS: Record<string, string> = {
  FULL_BODY: 'Все тело',
  UPPER_PULL: 'Верх (тяга)',
  UPPER_PUSH: 'Верх (жим)',
  LOWER_BODY: 'Низ тела',
  CORE_STABILITY: 'Кор (стабилизация)',
  CORE_DYNAMICS: 'Кор (динамика)',
  PREHAB_SHOULDER: 'Профилактика: плечи',
  PREHAB_KNEE: 'Профилактика: колени',
  PREHAB_BACK: 'Профилактика: спина',
};

const STATUS_LABELS: Record<string, string> = {
  RECOVERY: '🟢 Восстановление',
  DEVELOPMENT: '🟡 Развитие',
  PEAK: '🔴 Пик',
};

export default function AdminContentCheckPage() {
  const [result, setResult] = useState<ContentCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllGaps, setShowAllGaps] = useState(false);

  useEffect(() => {
    checkContent();
  }, []);

  const checkContent = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/content-check');
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error checking content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 9) return 'from-red-600 to-red-800';
    if (priority >= 7) return 'from-orange-600 to-orange-800';
    return 'from-blue-600 to-blue-800';
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 9)
      return (
        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
          🔥 КРИТИЧНО
        </span>
      );
    if (priority >= 7)
      return (
        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-bold">
          ⚠️ ВАЖНО
        </span>
      );
    return (
      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-bold">
        💡 ЖЕЛАТЕЛЬНО
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-10 h-10 rounded-full bg-[#1a1f3a] hover:bg-[#2d3448] flex items-center justify-center transition-colors">
              <Image
                src="/icons/arrow.svg"
                alt="Назад"
                width={20}
                height={20}
                style={{ transform: 'rotate(180deg)' }}
              />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">📊 Анализ контента</h1>
            <p className="text-sm text-gray-400 mt-1">
              Приоритеты для загрузки нового контента
            </p>
          </div>
          <button
            onClick={checkContent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
          >
            🔄 Обновить
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-[#1a1f3a] rounded-lg p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-400">Анализирую базу видео...</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && result && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Total Videos */}
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
                <div className="text-3xl font-bold mb-1">{result.stats.total}</div>
                <div className="text-white/90 text-sm">Всего видео</div>
              </div>

              {/* Critical Gaps */}
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-6">
                <div className="text-3xl font-bold mb-1">{result.stats.criticalGaps}</div>
                <div className="text-white/90 text-sm">🔥 Критичных пробелов</div>
              </div>

              {/* Important Gaps */}
              <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg p-6">
                <div className="text-3xl font-bold mb-1">{result.stats.importantGaps}</div>
                <div className="text-white/90 text-sm">⚠️ Важных пробелов</div>
              </div>
            </div>

            {/* Module Distribution */}
            <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">📦 Распределение по модулям</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {result.stats.byModule.FITNESS}
                  </div>
                  <div className="text-xs text-gray-400">💪 ОФП (стержневой)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {result.stats.byModule.WARMUP}
                  </div>
                  <div className="text-xs text-gray-400">🤸 Разминка</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {result.stats.byModule.COOLDOWN}
                  </div>
                  <div className="text-xs text-gray-400">🧘 Заминка</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {result.stats.byModule.TECHNIQUE}
                  </div>
                  <div className="text-xs text-gray-400">⚡ Техника</div>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">🎯 Распределение по статусам</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {result.stats.byStatus.RECOVERY}
                  </div>
                  <div className="text-xs text-gray-400">🟢 Восстановление</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {result.stats.byStatus.DEVELOPMENT}
                  </div>
                  <div className="text-xs text-gray-400">🟡 Развитие</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">
                    {result.stats.byStatus.PEAK}
                  </div>
                  <div className="text-xs text-gray-400">🔴 Пик</div>
                </div>
              </div>
            </div>

            {/* Top Priorities */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  🎯 Топ-{result.topPriorities.length} приоритетов
                </h3>
                <button
                  onClick={() => setShowAllGaps(!showAllGaps)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {showAllGaps ? 'Скрыть все' : `Показать все (${result.allGaps.length})`}
                </button>
              </div>

              <div className="space-y-4">
                {(showAllGaps ? result.allGaps : result.topPriorities).map((gap, index) => (
                  <div
                    key={index}
                    className={`bg-gradient-to-r ${getPriorityColor(gap.priority)} rounded-lg p-6`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h4 className="text-lg font-bold">
                            {MODULE_LABELS[gap.moduleType] || gap.moduleType}
                          </h4>
                          {getPriorityBadge(gap.priority)}
                          <span className="px-3 py-1 bg-black/30 rounded-full text-xs font-medium">
                            {gap.currentCount}/{gap.recommendedCount} видео
                          </span>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/60">Тип нагрузки:</span>
                            <span className="font-medium">
                              {LOAD_TYPE_LABELS[gap.loadType] || gap.loadType}
                            </span>
                          </div>

                          {gap.muscleGroup && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-white/60">Мышечная группа:</span>
                              <span className="font-medium">
                                {MUSCLE_GROUP_LABELS[gap.muscleGroup] || gap.muscleGroup}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-white/60">Статус тренировки:</span>
                            <span className="font-medium">
                              {STATUS_LABELS[gap.status] || gap.status}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-white/90 bg-black/20 rounded p-3">
                          💡 {gap.reason}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-black/30 rounded-full h-2 mb-3">
                      <div
                        className="bg-white h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (gap.currentCount / gap.recommendedCount) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    {/* Priority Number */}
                    <div className="text-right text-xs text-white/60">
                      Приоритет: {gap.priority}/10
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-[#1a1f3a] rounded-lg p-6">
              <h4 className="font-semibold mb-4">🚀 Быстрые действия</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href="/admin/videos">
                  <button className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg font-medium hover:opacity-90 transition-opacity">
                    ➕ Добавить видео
                  </button>
                </Link>
                <Link href="/admin/videos">
                  <button className="w-full py-3 px-4 bg-[#2d3448] rounded-lg font-medium hover:bg-[#3a4255] transition-colors">
                    📝 Управление видео
                  </button>
                </Link>
                <Link href="/admin">
                  <button className="w-full py-3 px-4 bg-[#2d3448] rounded-lg font-medium hover:bg-[#3a4255] transition-colors">
                    🏠 Админ панель
                  </button>
                </Link>
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2 text-blue-300">ℹ️ Как это работает?</h4>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>
                  • <strong>Критично (🔥)</strong>: Стержневой модуль FITNESS - без него
                  тренировка невозможна
                </li>
                <li>
                  • <strong>Важно (⚠️)</strong>: Разминка и заминка - обязательные части
                  тренировки
                </li>
                <li>
                  • <strong>Желательно (💡)</strong>: Техника - добавляет разнообразие и
                  специализацию
                </li>
                <li>
                  • Алгоритм анализирует совместимость типов нагрузки и покрытие всех статусов
                  (Восстановление/Развитие/Пик)
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
