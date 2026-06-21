'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface GapAnalysis {
  goal: string;
  moduleType: string;
  loadType: string;
  muscleGroup?: string;
  ageGroup?: string;
  complexity?: string;
  energyState?: string;
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
  byGoal: Record<string, number>;
  byAgeGroup: Record<string, number>;
  byComplexity: Record<string, number>;
  metaQuality: {
    missingModuleType: number;
    missingLoadType: number;
    missingMuscleGroup: number;
    missingComplexity: number;
    missingRpe: number;
    missingAgeGroups: number;
    missingTrainingGoals: number;
  };
  fullyTagged: number;
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

const GOAL_LABELS: Record<string, string> = {
  POWERFUL_SHOT: '🎯 Мощный бросок',
  OUTRUN_OPPONENT: '🦵🏻 Убегаем от соперника',
  STRENGTH_STABILITY: '💪🏻 Силовая борьба',
  SOFT_HANDS: '🏒 Мягкие ручки',
  FULL_GAME_ENDURANCE: '🫁 Выносливость',
  AGILITY: '⚡️ Маневренность',
  SPORT_LONGEVITY: '🏥 Долголетие',
};

const AGE_GROUP_LABELS: Record<string, string> = {
  CHILD: '7–10 лет',
  TEEN: '11–17 лет',
  YOUNG_ADULT: '18–34',
  ADULT: '35+',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  BEGINNER: 'Начинающий',
  AMATEUR: 'Любитель',
  ADVANCED: 'Продвинутый',
  PRO: 'Профи',
};

const ENERGY_LABELS: Record<string, string> = {
  TIRED: '😴 Устал',
  IN_TONE: '⚡️ В тонусе',
  FULLY_CHARGED: '🔋 Заряжен',
};

export default function AdminContentCheckPage() {
  const [result, setResult] = useState<ContentCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAllGaps, setShowAllGaps] = useState(false);
  const [goalFilter, setGoalFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'priorities' | 'metadata' | 'stats'>('priorities');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());

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

  const getGapKey = (gap: GapAnalysis) =>
    [
      gap.goal,
      gap.moduleType,
      gap.loadType,
      gap.muscleGroup || '-',
      gap.ageGroup || '-',
      gap.complexity || '-',
      gap.energyState || '-',
    ].join('|');

  const toggleGapDetails = (gapKey: string) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(gapKey)) {
        next.delete(gapKey);
      } else {
        next.add(gapKey);
      }
      return next;
    });
  };

  const gapsSource = showAllGaps
    ? result?.allGaps ?? []
    : result?.topPriorities ?? [];

  const filteredGaps = gapsSource.filter((gap) => {
    if (goalFilter && gap.goal !== goalFilter) return false;
    if (moduleFilter && gap.moduleType !== moduleFilter) return false;
    if (priorityFilter === 'critical' && gap.priority < 9) return false;
    if (priorityFilter === 'important' && (gap.priority < 6 || gap.priority >= 9)) return false;
    if (priorityFilter === 'desirable' && gap.priority >= 6) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
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
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveTab('priorities')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'priorities'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#1a1f3a] text-gray-300 hover:bg-[#2d3448]'
                }`}
              >
                Приоритеты
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'metadata'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#1a1f3a] text-gray-300 hover:bg-[#2d3448]'
                }`}
              >
                Метаданные
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#1a1f3a] text-gray-300 hover:bg-[#2d3448]'
                }`}
              >
                Статистика
              </button>
            </div>

            {activeTab === 'priorities' && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6">
                    <div className="text-3xl font-bold mb-1">{result.stats.total}</div>
                    <div className="text-white/90 text-sm">Всего видео</div>
                  </div>
                  <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-6">
                    <div className="text-3xl font-bold mb-1">{result.stats.criticalGaps}</div>
                    <div className="text-white/90 text-sm">🔥 Критичных пробелов</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-lg p-6">
                    <div className="text-3xl font-bold mb-1">{result.stats.importantGaps}</div>
                    <div className="text-white/90 text-sm">⚠️ Важных пробелов</div>
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

                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="w-full md:w-auto mb-4 px-4 py-2 rounded-lg bg-[#1a1f3a] hover:bg-[#2d3448] text-sm font-medium text-gray-200 transition-colors"
                  >
                    {filtersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
                  </button>

                  {filtersOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <select
                        value={goalFilter}
                        onChange={(e) => setGoalFilter(e.target.value)}
                        className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Все цели</option>
                        {Object.keys(result.stats.byGoal).map((goal) => (
                          <option key={goal} value={goal}>
                            {GOAL_LABELS[goal] || goal}
                          </option>
                        ))}
                      </select>
                      <select
                        value={moduleFilter}
                        onChange={(e) => setModuleFilter(e.target.value)}
                        className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Все модули</option>
                        {Object.keys(MODULE_LABELS).map((moduleType) => (
                          <option key={moduleType} value={moduleType}>
                            {MODULE_LABELS[moduleType]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">Все приоритеты</option>
                        <option value="critical">🔥 Критично</option>
                        <option value="important">⚠️ Важно</option>
                        <option value="desirable">💡 Желательно</option>
                      </select>
                    </div>
                  )}

                  <div className="space-y-3">
                    {filteredGaps.map((gap, index) => {
                      const gapKey = getGapKey(gap);
                      const isExpanded = expandedGaps.has(gapKey);

                      return (
                        <div
                          key={index}
                          className={`bg-gradient-to-r ${getPriorityColor(gap.priority)} rounded-lg p-4`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="text-base font-bold">
                                  {MODULE_LABELS[gap.moduleType] || gap.moduleType}
                                </h4>
                                {getPriorityBadge(gap.priority)}
                                <span className="px-2 py-1 bg-black/30 rounded-full text-[11px] font-medium">
                                  {gap.currentCount}/{gap.recommendedCount}
                                </span>
                              </div>
                              <div className="text-xs text-white/80">
                                {GOAL_LABELS[gap.goal] || gap.goal} •{' '}
                                {LOAD_TYPE_LABELS[gap.loadType] || gap.loadType}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleGapDetails(gapKey)}
                              className="text-xs text-white/80 hover:text-white"
                            >
                              {isExpanded ? 'Свернуть' : 'Подробнее'}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 text-sm">
                              {gap.muscleGroup && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60">Мышечная группа:</span>
                                  <span className="font-medium">
                                    {MUSCLE_GROUP_LABELS[gap.muscleGroup] || gap.muscleGroup}
                                  </span>
                                </div>
                              )}
                              {gap.ageGroup && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60">Возраст:</span>
                                  <span className="font-medium">
                                    {AGE_GROUP_LABELS[gap.ageGroup] || gap.ageGroup}
                                  </span>
                                </div>
                              )}
                              {gap.complexity && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60">Сложность:</span>
                                  <span className="font-medium">
                                    {COMPLEXITY_LABELS[gap.complexity] || gap.complexity}
                                  </span>
                                </div>
                              )}
                              {gap.energyState && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/60">Состояние:</span>
                                  <span className="font-medium">
                                    {ENERGY_LABELS[gap.energyState] || gap.energyState}
                                  </span>
                                </div>
                              )}
                              <p className="text-sm text-white/90 bg-black/20 rounded p-3">
                                💡 {gap.reason}
                              </p>

                              <div className="w-full bg-black/30 rounded-full h-2">
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
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'metadata' && (
              <>
                <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">🧩 Качество метаданных</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Полностью размечено</span>
                      <span className="font-semibold">
                        {result.stats.fullyTagged} / {result.stats.total}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без типа модуля</span>
                      <span className="font-semibold text-red-400">
                        {result.stats.metaQuality.missingModuleType}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без типа нагрузки</span>
                      <span className="font-semibold text-red-400">
                        {result.stats.metaQuality.missingLoadType}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без направления нагрузки</span>
                      <span className="font-semibold text-red-400">
                        {result.stats.metaQuality.missingMuscleGroup}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без сложности</span>
                      <span className="font-semibold text-orange-400">
                        {result.stats.metaQuality.missingComplexity}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без RPE</span>
                      <span className="font-semibold text-orange-400">
                        {result.stats.metaQuality.missingRpe}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без возрастных групп</span>
                      <span className="font-semibold text-orange-400">
                        {result.stats.metaQuality.missingAgeGroups}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#12162a] rounded-lg px-4 py-3">
                      <span className="text-gray-400">Без цели тренировки</span>
                      <span className="font-semibold text-orange-400">
                        {result.stats.metaQuality.missingTrainingGoals}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-blue-300">ℹ️ Как это работает?</h4>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>
                      • <strong>Критично (🔥)</strong>: отсутствуют базовые модули под цель и тип
                      нагрузки — алгоритм не сможет собрать тренировку
                    </li>
                    <li>
                      • <strong>Важно (⚠️)</strong>: недобор по возрасту/модулям/сложности
                    </li>
                    <li>
                      • <strong>Желательно (💡)</strong>: нет RPE-диапазонов или редкие комбинации
                    </li>
                    <li>
                      • Алгоритм учитывает цель, тип модуля, возраст, сложность и RPE
                    </li>
                  </ul>
                </div>
              </>
            )}

            {activeTab === 'stats' && (
              <>
                <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">📦 Распределение по модулям</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {result.stats.byModule.FITNESS}
                      </div>
                      <div className="text-xs text-gray-400">💪 ОФП</div>
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

                <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">🎯 Распределение по целям</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(result.stats.byGoal).map(([goal, count]) => (
                      <div key={goal} className="flex items-center justify-between bg-[#12162a] rounded-lg px-4 py-3">
                        <span className="text-sm text-gray-300">
                          {GOAL_LABELS[goal] || goal}
                        </span>
                        <span className="text-sm font-semibold text-blue-300">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#1a1f3a] rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">👶 Возрастные группы</h3>
                    <div className="space-y-3">
                      {Object.entries(result.stats.byAgeGroup).map(([group, count]) => (
                        <div key={group} className="flex items-center justify-between bg-[#12162a] rounded-lg px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {AGE_GROUP_LABELS[group] || group}
                          </span>
                          <span className="text-sm font-semibold text-blue-300">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#1a1f3a] rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">🏋️ Сложность</h3>
                    <div className="space-y-3">
                      {Object.entries(result.stats.byComplexity).map(([complexity, count]) => (
                        <div key={complexity} className="flex items-center justify-between bg-[#12162a] rounded-lg px-4 py-3">
                          <span className="text-sm text-gray-300">
                            {COMPLEXITY_LABELS[complexity] || complexity}
                          </span>
                          <span className="text-sm font-semibold text-blue-300">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <select
                  value={goalFilter}
                  onChange={(e) => setGoalFilter(e.target.value)}
                  className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Все цели</option>
                  {Object.keys(result.stats.byGoal).map((goal) => (
                    <option key={goal} value={goal}>
                      {GOAL_LABELS[goal] || goal}
                    </option>
                  ))}
                </select>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Все модули</option>
                  {Object.keys(MODULE_LABELS).map((moduleType) => (
                    <option key={moduleType} value={moduleType}>
                      {MODULE_LABELS[moduleType]}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Все приоритеты</option>
                  <option value="critical">🔥 Критично</option>
                  <option value="important">⚠️ Важно</option>
                  <option value="desirable">💡 Желательно</option>
                </select>
              </div>

              <div className="space-y-4">
                {filteredGaps.map((gap, index) => (
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
                          <span className="px-3 py-1 bg-black/30 rounded-full text-xs font-medium">
                            {GOAL_LABELS[gap.goal] || gap.goal}
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

                          {gap.ageGroup && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-white/60">Возраст:</span>
                              <span className="font-medium">
                                {AGE_GROUP_LABELS[gap.ageGroup] || gap.ageGroup}
                              </span>
                            </div>
                          )}

                          {gap.complexity && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-white/60">Сложность:</span>
                              <span className="font-medium">
                                {COMPLEXITY_LABELS[gap.complexity] || gap.complexity}
                              </span>
                            </div>
                          )}

                          {gap.energyState && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-white/60">Состояние:</span>
                              <span className="font-medium">
                                {ENERGY_LABELS[gap.energyState] || gap.energyState}
                              </span>
                            </div>
                          )}
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
            <div className="bg-[#1a1f3a] rounded-lg p-6 mt-6">
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
          </>
        )}
      </div>
    </div>
  );
}
