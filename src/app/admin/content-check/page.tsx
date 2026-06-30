'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { priorityTier } from '@/lib/content-check-priority';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkContent();
  }, []);

  const checkContent = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/content-check');
      if (response.status === 401) {
        setError('Сессия администратора истекла. Войдите в админку заново.');
        setResult(null);
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !data?.stats) {
        setError(data?.error || 'Не удалось проанализировать контент. Попробуйте обновить.');
        setResult(null);
        return;
      }
      setResult(data);
    } catch (err) {
      console.error('Error checking content:', err);
      setError('Ошибка сети. Проверьте соединение и обновите.');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Акцентный цвет тира (полоска карточки, число, бейдж) — спокойная палитра.
  const tierColor = (priority: number) => {
    const t = priorityTier(priority);
    return t === 'critical' ? '#FF6B6B' : t === 'important' ? '#FFA53C' : '#445CFF';
  };

  const getPriorityBadge = (priority: number) => {
    const t = priorityTier(priority);
    const c = tierColor(priority);
    const label = t === 'critical' ? '🔥 КРИТИЧНО' : t === 'important' ? '⚠️ ВАЖНО' : '💡 ЖЕЛАТЕЛЬНО';
    return (
      <span
        className="px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ backgroundColor: `${c}22`, color: c }}
      >
        {label}
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
    if (priorityFilter && priorityTier(gap.priority) !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#060919] text-white p-4 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <button className="w-10 h-10 rounded-full bg-[#101530] border border-[#26252F] hover:border-white/20 flex items-center justify-center transition-colors">
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
            <p className="text-sm text-[#AEABBB] mt-1">
              Приоритеты для загрузки нового контента
            </p>
          </div>
          <button
            onClick={checkContent}
            className="px-4 py-2 bg-[#A1FF4A] text-[#060919] hover:opacity-90 rounded-full text-sm font-bold transition-opacity"
          >
            🔄 Обновить
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            <p className="mt-4 text-[#AEABBB]">Анализирую базу видео...</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
            <p className="text-red-300 font-semibold mb-4">{error}</p>
            <button
              onClick={checkContent}
              className="px-4 py-2 bg-[#A1FF4A] text-[#060919] hover:opacity-90 rounded-full text-sm font-bold transition-opacity"
            >
              🔄 Повторить
            </button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && result && (
          <>
            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveTab('priorities')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'priorities'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#101530] text-[#AEABBB] border border-[#26252F] hover:border-white/20'
                }`}
              >
                Приоритеты
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'metadata'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#101530] text-[#AEABBB] border border-[#26252F] hover:border-white/20'
                }`}
              >
                Метаданные
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                    : 'bg-[#101530] text-[#AEABBB] border border-[#26252F] hover:border-white/20'
                }`}
              >
                Статистика
              </button>
            </div>

            {activeTab === 'priorities' && (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5">
                    <div className="text-3xl font-bold mb-1 text-white">{result.stats.total}</div>
                    <div className="text-[#AEABBB] text-sm">Всего видео</div>
                  </div>
                  <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5">
                    <div className="text-3xl font-bold mb-1" style={{ color: '#FF6B6B' }}>{result.stats.criticalGaps}</div>
                    <div className="text-[#AEABBB] text-sm">🔥 Критичных пробелов</div>
                  </div>
                  <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5">
                    <div className="text-3xl font-bold mb-1" style={{ color: '#FFA53C' }}>{result.stats.importantGaps}</div>
                    <div className="text-[#AEABBB] text-sm">⚠️ Важных пробелов</div>
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
                      className="text-sm text-[#A1FF4A] hover:opacity-80"
                    >
                      {showAllGaps ? 'Скрыть все' : `Показать все (${result.allGaps.length})`}
                    </button>
                  </div>

                  <button
                    onClick={() => setFiltersOpen(!filtersOpen)}
                    className="w-full md:w-auto mb-4 px-4 py-2 rounded-full bg-[#101530] border border-[#26252F] hover:border-white/20 text-sm font-medium text-[#AEABBB] transition-colors"
                  >
                    {filtersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
                  </button>

                  {filtersOpen && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                      <select
                        value={goalFilter}
                        onChange={(e) => setGoalFilter(e.target.value)}
                        className="bg-[#060919] border border-[#26252F] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#445CFF]"
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
                        className="bg-[#060919] border border-[#26252F] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#445CFF]"
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
                        className="bg-[#060919] border border-[#26252F] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#445CFF]"
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
                          className="rounded-2xl border border-[#26252F] bg-[#101530] p-4"
                          style={{ borderLeftWidth: 4, borderLeftColor: tierColor(gap.priority) }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h4 className="text-base font-bold text-white">
                                  {MODULE_LABELS[gap.moduleType] || gap.moduleType}
                                </h4>
                                {getPriorityBadge(gap.priority)}
                                <span className="px-2 py-1 bg-white/[0.06] rounded-full text-[11px] font-medium text-[#AEABBB]">
                                  {gap.currentCount}/{gap.recommendedCount}
                                </span>
                              </div>
                              <div className="text-xs text-[#AEABBB]">
                                {GOAL_LABELS[gap.goal] || gap.goal} •{' '}
                                {LOAD_TYPE_LABELS[gap.loadType] || gap.loadType}
                              </div>
                            </div>
                            <button
                              onClick={() => toggleGapDetails(gapKey)}
                              className="text-xs text-[#AEABBB] hover:text-white shrink-0"
                            >
                              {isExpanded ? 'Свернуть' : 'Подробнее'}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2 text-sm">
                              {gap.muscleGroup && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#AEABBB]">Мышечная группа:</span>
                                  <span className="font-medium text-white">
                                    {MUSCLE_GROUP_LABELS[gap.muscleGroup] || gap.muscleGroup}
                                  </span>
                                </div>
                              )}
                              {gap.ageGroup && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#AEABBB]">Возраст:</span>
                                  <span className="font-medium text-white">
                                    {AGE_GROUP_LABELS[gap.ageGroup] || gap.ageGroup}
                                  </span>
                                </div>
                              )}
                              {gap.complexity && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#AEABBB]">Сложность:</span>
                                  <span className="font-medium text-white">
                                    {COMPLEXITY_LABELS[gap.complexity] || gap.complexity}
                                  </span>
                                </div>
                              )}
                              {gap.energyState && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[#AEABBB]">Состояние:</span>
                                  <span className="font-medium text-white">
                                    {ENERGY_LABELS[gap.energyState] || gap.energyState}
                                  </span>
                                </div>
                              )}
                              <p className="text-sm text-white/90 bg-[#060919] rounded-lg p-3">
                                💡 {gap.reason}
                              </p>

                              <div className="w-full bg-[#060919] rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(
                                      (gap.currentCount / gap.recommendedCount) * 100,
                                      100
                                    )}%`,
                                    backgroundColor: tierColor(gap.priority),
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
                <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5 mb-6">
                  <h3 className="text-lg font-semibold mb-4">🧩 Качество метаданных</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Полностью размечено</span>
                      <span className="font-semibold">
                        {result.stats.fullyTagged} / {result.stats.total}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без типа модуля</span>
                      <span className="font-semibold text-[#FF6B6B]">
                        {result.stats.metaQuality.missingModuleType}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без типа нагрузки</span>
                      <span className="font-semibold text-[#FF6B6B]">
                        {result.stats.metaQuality.missingLoadType}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без направления нагрузки</span>
                      <span className="font-semibold text-[#FF6B6B]">
                        {result.stats.metaQuality.missingMuscleGroup}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без сложности</span>
                      <span className="font-semibold text-[#FFA53C]">
                        {result.stats.metaQuality.missingComplexity}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без RPE</span>
                      <span className="font-semibold text-[#FFA53C]">
                        {result.stats.metaQuality.missingRpe}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без возрастных групп</span>
                      <span className="font-semibold text-[#FFA53C]">
                        {result.stats.metaQuality.missingAgeGroups}
                      </span>
                    </div>
                    <div className="flex justify-between bg-[#060919] rounded-lg px-4 py-3">
                      <span className="text-[#AEABBB]">Без цели тренировки</span>
                      <span className="font-semibold text-[#FFA53C]">
                        {result.stats.metaQuality.missingTrainingGoals}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#445CFF]/10 border border-[#445CFF]/30 rounded-2xl p-4">
                  <h4 className="font-semibold mb-2 text-[#9FB2FF]">ℹ️ Как это работает?</h4>
                  <ul className="text-sm text-[#AEABBB] space-y-1">
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
                <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5 mb-6">
                  <h3 className="text-lg font-semibold mb-4">📦 Распределение по модулям</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-400">
                        {result.stats.byModule.FITNESS}
                      </div>
                      <div className="text-xs text-[#AEABBB]">💪 ОФП</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">
                        {result.stats.byModule.WARMUP}
                      </div>
                      <div className="text-xs text-[#AEABBB]">🤸 Разминка</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-400">
                        {result.stats.byModule.COOLDOWN}
                      </div>
                      <div className="text-xs text-[#AEABBB]">🧘 Заминка</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">
                        {result.stats.byModule.TECHNIQUE}
                      </div>
                      <div className="text-xs text-[#AEABBB]">⚡ Техника</div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5 mb-6">
                  <h3 className="text-lg font-semibold mb-4">🎯 Распределение по целям</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(result.stats.byGoal).map(([goal, count]) => (
                      <div key={goal} className="flex items-center justify-between bg-[#060919] rounded-lg px-4 py-3">
                        <span className="text-sm text-[#AEABBB]">
                          {GOAL_LABELS[goal] || goal}
                        </span>
                        <span className="text-sm font-semibold text-[#A1FF4A]">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5">
                    <h3 className="text-lg font-semibold mb-4">👶 Возрастные группы</h3>
                    <div className="space-y-3">
                      {Object.entries(result.stats.byAgeGroup).map(([group, count]) => (
                        <div key={group} className="flex items-center justify-between bg-[#060919] rounded-lg px-4 py-3">
                          <span className="text-sm text-[#AEABBB]">
                            {AGE_GROUP_LABELS[group] || group}
                          </span>
                          <span className="text-sm font-semibold text-[#A1FF4A]">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5">
                    <h3 className="text-lg font-semibold mb-4">🏋️ Сложность</h3>
                    <div className="space-y-3">
                      {Object.entries(result.stats.byComplexity).map(([complexity, count]) => (
                        <div key={complexity} className="flex items-center justify-between bg-[#060919] rounded-lg px-4 py-3">
                          <span className="text-sm text-[#AEABBB]">
                            {COMPLEXITY_LABELS[complexity] || complexity}
                          </span>
                          <span className="text-sm font-semibold text-[#A1FF4A]">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Quick Actions */}
            <div className="bg-[#101530] border border-[#26252F] rounded-2xl p-5 mt-6">
              <h4 className="font-semibold mb-4">🚀 Быстрые действия</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link href="/admin/videos">
                  <button className="w-full py-3 px-4 bg-[#A1FF4A] text-[#060919] rounded-full font-bold hover:opacity-90 transition-opacity">
                    ➕ Добавить видео
                  </button>
                </Link>
                <Link href="/admin/videos">
                  <button className="w-full py-3 px-4 bg-[#060919] border border-[#26252F] rounded-full font-medium text-white hover:border-white/20 transition-colors">
                    📝 Управление видео
                  </button>
                </Link>
                <Link href="/admin">
                  <button className="w-full py-3 px-4 bg-[#060919] border border-[#26252F] rounded-full font-medium text-white hover:border-white/20 transition-colors">
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
