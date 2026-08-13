'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { priorityTier } from '@/lib/content-check-priority';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  Kpi,
  AdminButton,
  EmptyState,
  inputStyle,
} from '@/components/admin/ui';
import {
  AlertCircle, AlertTriangle, Baby, BatteryFull, BatteryMedium, Boxes, ChevronDown,
  Crosshair, Dumbbell, Filter, FilterX, Footprints, Gauge, Hand, HelpCircle,
  HeartPulse, Info, LayoutDashboard, Leaf, Lightbulb, ListChecks, ListVideo,
  Loader2, Moon, Plus, Puzzle, RefreshCw, ScanSearch, Shuffle, Stethoscope,
  Swords, Target, Video, Wind, Zap,
  type LucideIcon,
} from 'lucide-react';

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

// ─── Словари подписей ──────────────────────────────────────────────────────
// Эмодзи вынесены из строк в отдельные карты иконок: один смысл — одна иконка.
// Раньше ⚡ означал одновременно «Техника», «Маневренность» и «В тонусе», а 💪
// — и «ОФП», и «Силовую борьбу»; вставить SVG в <option> нельзя, поэтому в
// селектах остаётся чистый текст, а иконки живут в карточках.

const MODULE_LABELS: Record<string, string> = {
  FITNESS: 'ОФП',
  WARMUP: 'Разминка',
  COOLDOWN: 'Заминка',
  TECHNIQUE: 'Техника',
};

const MODULE_ICONS: Record<string, LucideIcon> = {
  FITNESS: Dumbbell,
  WARMUP: Wind,
  COOLDOWN: Leaf,
  TECHNIQUE: Zap,
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
  POWERFUL_SHOT: 'Мощный бросок',
  OUTRUN_OPPONENT: 'Убегаем от соперника',
  STRENGTH_STABILITY: 'Силовая борьба',
  SOFT_HANDS: 'Мягкие ручки',
  FULL_GAME_ENDURANCE: 'Выносливость',
  AGILITY: 'Маневренность',
  SPORT_LONGEVITY: 'Долголетие',
};

const GOAL_ICONS: Record<string, LucideIcon> = {
  POWERFUL_SHOT: Crosshair,
  OUTRUN_OPPONENT: Footprints,
  STRENGTH_STABILITY: Swords,
  SOFT_HANDS: Hand,
  FULL_GAME_ENDURANCE: HeartPulse,
  AGILITY: Shuffle,
  SPORT_LONGEVITY: Stethoscope,
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
  TIRED: 'Устал',
  IN_TONE: 'В тонусе',
  FULLY_CHARGED: 'Заряжен',
};

const ENERGY_ICONS: Record<string, LucideIcon> = {
  TIRED: Moon,
  IN_TONE: BatteryMedium,
  FULLY_CHARGED: BatteryFull,
};

/** Тир приоритета: цвет только из токенов, иконка — одна на смысл. */
const TIER_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  critical: { label: 'КРИТИЧНО', color: 'var(--color-danger)', Icon: AlertTriangle },
  important: { label: 'ВАЖНО', color: 'var(--color-brand-blue)', Icon: AlertCircle },
  desirable: { label: 'ЖЕЛАТЕЛЬНО', color: 'var(--color-muted)', Icon: Info },
};

const TABS = [
  { id: 'priorities' as const, label: 'Приоритеты' },
  { id: 'metadata' as const, label: 'Метаданные' },
  { id: 'stats' as const, label: 'Статистика' },
];

/* ─── Локальные примитивы страницы ─────────────────────────────────────── */

/** Строка «подпись — значение» во вложенном блоке карточки. */
function MetaRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'danger' | 'warn' | 'brand';
}) {
  const COLOR: Record<string, string> = {
    default: 'var(--color-ink)',
    danger: 'var(--color-danger)',
    warn: 'var(--color-brand-blue)',
    brand: 'var(--color-brand)',
  };
  return (
    <div
      className="flex items-center justify-between gap-3"
      style={{
        padding: '12px 16px',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--color-night)',
        border: '1px solid var(--border-hairline)',
        fontSize: 14,
      }}
    >
      <span className="min-w-0 truncate" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <span className="shrink-0" style={{ fontWeight: 700, color: COLOR[tone] }}>
        {value}
      </span>
    </div>
  );
}

/** Полоска заполнения «сколько есть из рекомендованного». */
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(max > 0 ? (value / max) * 100 : 0, 100);
  // span, а не div — компонент рендерится внутри <button> (шапка карточки пробела)
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="block"
      style={{
        width: '100%',
        height: 6,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-night)',
        overflow: 'hidden',
      }}
    >
      <span className="block" style={{ width: `${pct}%`, height: '100%', background: color }} />
    </span>
  );
}

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

  const tierMeta = (priority: number) => TIER_META[priorityTier(priority)] ?? TIER_META.desirable;

  const getPriorityBadge = (priority: number) => {
    const { label, color, Icon } = tierMeta(priority);
    return (
      <span
        className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
        style={{
          padding: '4px 8px',
          borderRadius: 'var(--radius-pill)',
          fontSize: 12,
          fontWeight: 800,
          color,
          border: `1px solid ${color}`,
          background: 'transparent',
        }}
      >
        <Icon size={16} aria-hidden />
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

  const hasFilters = Boolean(goalFilter || moduleFilter || priorityFilter);

  return (
    <AdminPage>
      <PageHeader
        title="Анализ контента"
        icon={ScanSearch}
        subtitle="Приоритеты для загрузки нового контента"
        actions={
          <AdminButton tone="primary" onClick={checkContent} disabled={isLoading}>
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} aria-hidden />
            Обновить
          </AdminButton>
        }
      />

      {/* ───────── Загрузка ───────── */}
      {isLoading && (
        <AdminCard>
          <div className="flex flex-col items-center justify-center" style={{ padding: '48px 16px' }}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-brand)' }} aria-hidden />
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-muted)' }}>
              Анализирую базу видео…
            </p>
          </div>
        </AdminCard>
      )}

      {/* ───────── Ошибка ───────── */}
      {!isLoading && error && (
        <AdminCard tone="danger">
          <EmptyState icon={AlertTriangle} tone="danger" title="Анализ не выполнен" hint={error} />
          <div className="flex justify-center">
            <AdminButton tone="secondary" icon={RefreshCw} onClick={checkContent}>
              Повторить
            </AdminButton>
          </div>
        </AdminCard>
      )}

      {/* ───────── Результаты ───────── */}
      {!isLoading && !error && result && (
        <>
          {/* Вкладки */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-2" style={{ whiteSpace: 'nowrap' }}>
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={active}
                    className="shrink-0 transition-colors"
                    style={{
                      minHeight: 40,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'var(--color-brand)' : 'var(--color-surface)',
                      color: active ? 'var(--color-night)' : 'var(--color-muted)',
                      border: `1px solid ${active ? 'var(--color-brand)' : 'var(--border-hairline)'}`,
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'priorities' && (
            <>
              {/* Счётчики */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <Kpi icon={Video} label="Всего видео" value={result.stats.total} />
                <Kpi
                  icon={AlertTriangle}
                  label="Критичных пробелов"
                  value={result.stats.criticalGaps}
                />
                <Kpi
                  icon={AlertCircle}
                  label="Важных пробелов"
                  value={result.stats.importantGaps}
                />
              </div>

              {/* Пробелы */}
              <div className="mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  {/* Заголовок показывает реально отрисованное количество */}
                  <SectionTitle icon={ListChecks}>
                    Пробелы: {filteredGaps.length} из {result.allGaps.length}
                  </SectionTitle>
                  <AdminButton tone="secondary" size="sm" onClick={() => setShowAllGaps(!showAllGaps)}>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      style={{ transform: showAllGaps ? 'rotate(180deg)' : 'none' }}
                    />
                    {showAllGaps ? 'Только топ' : `Показать все (${result.allGaps.length})`}
                  </AdminButton>
                </div>

                <AdminButton
                  tone="secondary"
                  size="sm"
                  icon={Filter}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  style={{ marginBottom: 16 }}
                >
                  {filtersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
                </AdminButton>

                {filtersOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <select
                      aria-label="Фильтр по цели"
                      value={goalFilter}
                      onChange={(e) => setGoalFilter(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Все цели</option>
                      {Object.keys(result.stats.byGoal).map((goal) => (
                        <option key={goal} value={goal}>
                          {GOAL_LABELS[goal] || goal}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Фильтр по модулю"
                      value={moduleFilter}
                      onChange={(e) => setModuleFilter(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Все модули</option>
                      {Object.keys(MODULE_LABELS).map((moduleType) => (
                        <option key={moduleType} value={moduleType}>
                          {MODULE_LABELS[moduleType]}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Фильтр по приоритету"
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Все приоритеты</option>
                      <option value="critical">Критично</option>
                      <option value="important">Важно</option>
                      <option value="desirable">Желательно</option>
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  {filteredGaps.map((gap, index) => {
                    const gapKey = getGapKey(gap);
                    const isExpanded = expandedGaps.has(gapKey);
                    const { color } = tierMeta(gap.priority);
                    const ModuleIcon = MODULE_ICONS[gap.moduleType];
                    const GoalIcon = GOAL_ICONS[gap.goal];
                    const EnergyIcon = gap.energyState ? ENERGY_ICONS[gap.energyState] : undefined;

                    return (
                      <AdminCard key={index} style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Полоска тира вместо неравномерной левой рамки 4px поверх hairline */}
                        <div style={{ height: 3, background: color }} aria-hidden />

                        {/* Кликабельна вся шапка карточки, а не текст «Подробнее» 12px */}
                        <button
                          type="button"
                          onClick={() => toggleGapDetails(gapKey)}
                          aria-expanded={isExpanded}
                          className="block w-full text-left transition-colors hover:brightness-125"
                          style={{ padding: 16, background: 'transparent', border: 'none', cursor: 'pointer' }}
                        >
                          {/* Внутри <button> — только phrasing-контент (span) */}
                          <span className="flex items-start justify-between gap-3">
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span
                                  className="inline-flex items-center gap-2"
                                  style={{ fontSize: 16, fontWeight: 700 }}
                                >
                                  {ModuleIcon && (
                                    <ModuleIcon size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                                  )}
                                  {MODULE_LABELS[gap.moduleType] || gap.moduleType}
                                </span>
                                {getPriorityBadge(gap.priority)}
                                <span
                                  className="shrink-0"
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 'var(--radius-pill)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--color-muted)',
                                    border: '1px solid var(--border-hairline)',
                                  }}
                                >
                                  {gap.currentCount}/{gap.recommendedCount}
                                </span>
                              </span>

                              <span
                                className="flex flex-wrap items-center gap-2"
                                style={{ marginTop: 8, fontSize: 13, color: 'var(--color-muted)' }}
                              >
                                <span className="inline-flex items-center gap-1">
                                  {GoalIcon && <GoalIcon size={16} aria-hidden />}
                                  {GOAL_LABELS[gap.goal] || gap.goal}
                                </span>
                                <span aria-hidden>•</span>
                                <span>{LOAD_TYPE_LABELS[gap.loadType] || gap.loadType}</span>
                              </span>

                              {/* Прогресс виден и в свёрнутом состоянии */}
                              <span className="block" style={{ marginTop: 12 }}>
                                <ProgressBar
                                  value={gap.currentCount}
                                  max={gap.recommendedCount}
                                  color={color}
                                />
                              </span>
                            </span>

                            <ChevronDown
                              size={20}
                              aria-hidden
                              className="shrink-0 transition-transform"
                              style={{
                                color: 'var(--color-muted)',
                                transform: isExpanded ? 'rotate(180deg)' : 'none',
                              }}
                            />
                          </span>
                        </button>

                        {isExpanded && (
                          <div
                            className="space-y-2"
                            style={{
                              padding: 16,
                              borderTop: '1px solid var(--border-hairline)',
                            }}
                          >
                            {gap.muscleGroup && (
                              <MetaRow
                                label="Мышечная группа"
                                value={MUSCLE_GROUP_LABELS[gap.muscleGroup] || gap.muscleGroup}
                              />
                            )}
                            {gap.ageGroup && (
                              <MetaRow
                                label="Возраст"
                                value={AGE_GROUP_LABELS[gap.ageGroup] || gap.ageGroup}
                              />
                            )}
                            {gap.complexity && (
                              <MetaRow
                                label="Сложность"
                                value={COMPLEXITY_LABELS[gap.complexity] || gap.complexity}
                              />
                            )}
                            {gap.energyState && (
                              <MetaRow
                                label="Состояние"
                                value={
                                  <span className="inline-flex items-center gap-1">
                                    {EnergyIcon && <EnergyIcon size={16} aria-hidden />}
                                    {ENERGY_LABELS[gap.energyState] || gap.energyState}
                                  </span>
                                }
                              />
                            )}

                            <div
                              className="flex items-start gap-2"
                              style={{
                                padding: 12,
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-night)',
                                border: '1px solid var(--border-hairline)',
                                fontSize: 14,
                              }}
                            >
                              <Lightbulb
                                size={16}
                                className="shrink-0"
                                style={{ color: 'var(--color-brand)', marginTop: 2 }}
                                aria-hidden
                              />
                              <p style={{ margin: 0 }}>{gap.reason}</p>
                            </div>
                          </div>
                        )}
                      </AdminCard>
                    );
                  })}

                  {filteredGaps.length === 0 && (
                    <AdminCard>
                      {result.allGaps.length === 0 ? (
                        <EmptyState
                          icon={ListChecks}
                          title="Пробелов не найдено"
                          hint="База покрывает все рекомендованные комбинации"
                        />
                      ) : (
                        <>
                          <EmptyState
                            icon={FilterX}
                            title="Под фильтры ничего не попало"
                            hint={`Всего пробелов: ${result.allGaps.length}`}
                          />
                          {hasFilters && (
                            <div className="flex justify-center">
                              <AdminButton
                                tone="secondary"
                                icon={FilterX}
                                onClick={() => {
                                  setGoalFilter('');
                                  setModuleFilter('');
                                  setPriorityFilter('');
                                }}
                              >
                                Сбросить фильтры
                              </AdminButton>
                            </div>
                          )}
                        </>
                      )}
                    </AdminCard>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'metadata' && (
            <>
              <div className="mb-6">
                <SectionTitle icon={Puzzle}>Качество метаданных</SectionTitle>
                <AdminCard>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <MetaRow
                      label="Полностью размечено"
                      value={`${result.stats.fullyTagged} / ${result.stats.total}`}
                      tone="brand"
                    />
                    <MetaRow
                      label="Без типа модуля"
                      value={result.stats.metaQuality.missingModuleType}
                      tone="danger"
                    />
                    <MetaRow
                      label="Без типа нагрузки"
                      value={result.stats.metaQuality.missingLoadType}
                      tone="danger"
                    />
                    <MetaRow
                      label="Без направления нагрузки"
                      value={result.stats.metaQuality.missingMuscleGroup}
                      tone="danger"
                    />
                    <MetaRow
                      label="Без сложности"
                      value={result.stats.metaQuality.missingComplexity}
                      tone="warn"
                    />
                    <MetaRow label="Без RPE" value={result.stats.metaQuality.missingRpe} tone="warn" />
                    <MetaRow
                      label="Без возрастных групп"
                      value={result.stats.metaQuality.missingAgeGroups}
                      tone="warn"
                    />
                    <MetaRow
                      label="Без цели тренировки"
                      value={result.stats.metaQuality.missingTrainingGoals}
                      tone="warn"
                    />
                  </div>
                </AdminCard>
              </div>

              {/* Легенда: строка = иконка тира + название + пояснение */}
              <AdminCard>
                <h3
                  className="flex items-center gap-2"
                  style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px' }}
                >
                  <HelpCircle size={20} style={{ color: 'var(--color-brand-blue)' }} aria-hidden />
                  Как это работает?
                </h3>
                <div className="space-y-3" style={{ fontSize: 14, color: 'var(--color-muted)' }}>
                  {(['critical', 'important', 'desirable'] as const).map((tier) => {
                    const { label, color, Icon } = TIER_META[tier];
                    const hint =
                      tier === 'critical'
                        ? 'отсутствуют базовые модули под цель и тип нагрузки — алгоритм не сможет собрать тренировку'
                        : tier === 'important'
                          ? 'недобор по возрасту / модулям / сложности'
                          : 'нет RPE-диапазонов или редкие комбинации';
                    return (
                      <div key={tier} className="flex items-start gap-2">
                        <Icon size={16} className="shrink-0" style={{ color, marginTop: 3 }} aria-hidden />
                        <p style={{ margin: 0 }}>
                          <strong style={{ color: 'var(--color-ink)' }}>{label}</strong>: {hint}
                        </p>
                      </div>
                    );
                  })}
                  <div className="flex items-start gap-2">
                    <Info
                      size={16}
                      className="shrink-0"
                      style={{ color: 'var(--color-muted)', marginTop: 3 }}
                      aria-hidden
                    />
                    <p style={{ margin: 0 }}>
                      Алгоритм учитывает цель, тип модуля, возраст, сложность и RPE
                    </p>
                  </div>
                </div>
              </AdminCard>
            </>
          )}

          {activeTab === 'stats' && (
            <>
              <div className="mb-6">
                <SectionTitle icon={Boxes}>Распределение по модулям</SectionTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(Object.keys(MODULE_LABELS) as Array<keyof Stats['byModule']>).map((key) => (
                    <Kpi
                      key={key}
                      icon={MODULE_ICONS[key]}
                      label={MODULE_LABELS[key]}
                      value={result.stats.byModule[key]}
                    />
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <SectionTitle icon={Target}>Распределение по целям</SectionTitle>
                <AdminCard>
                  {Object.keys(result.stats.byGoal).length === 0 ? (
                    <EmptyState icon={Target} title="Пока нет данных" />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(result.stats.byGoal).map(([goal, count]) => (
                        <MetaRow
                          key={goal}
                          label={GOAL_LABELS[goal] || goal}
                          value={count}
                          tone="brand"
                        />
                      ))}
                    </div>
                  )}
                </AdminCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <SectionTitle icon={Baby}>Возрастные группы</SectionTitle>
                  <AdminCard>
                    {Object.keys(result.stats.byAgeGroup).length === 0 ? (
                      <EmptyState icon={Baby} title="Пока нет данных" />
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(result.stats.byAgeGroup).map(([group, count]) => (
                          <MetaRow
                            key={group}
                            label={AGE_GROUP_LABELS[group] || group}
                            value={count}
                            tone="brand"
                          />
                        ))}
                      </div>
                    )}
                  </AdminCard>
                </div>

                <div>
                  <SectionTitle icon={Gauge}>Сложность</SectionTitle>
                  <AdminCard>
                    {Object.keys(result.stats.byComplexity).length === 0 ? (
                      <EmptyState icon={Gauge} title="Пока нет данных" />
                    ) : (
                      <div className="space-y-3">
                        {Object.entries(result.stats.byComplexity).map(([complexity, count]) => (
                          <MetaRow
                            key={complexity}
                            label={COMPLEXITY_LABELS[complexity] || complexity}
                            value={count}
                            tone="brand"
                          />
                        ))}
                      </div>
                    )}
                  </AdminCard>
                </div>
              </div>
            </>
          )}

          {/* ───────── Быстрые действия ─────────
              Отделены разрывом 32 и собственным заголовком: блок общий для всех
              вкладок и раньше слипался с контентом вкладки «Метаданные».
              Ссылки больше не оборачивают <button> (невалидная вложенность). */}
          <div style={{ marginTop: 32, borderTop: '1px solid var(--border-hairline)', paddingTop: 24 }}>
            <SectionTitle icon={ListChecks}>Быстрые действия</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link
                href="/admin/videos"
                className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                style={{
                  minHeight: 44,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'var(--color-brand)',
                  color: 'var(--color-night)',
                }}
              >
                <Plus size={20} aria-hidden />
                Добавить видео
              </Link>
              <Link
                href="/admin/videos"
                className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                style={{
                  minHeight: 44,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <ListVideo size={20} aria-hidden />
                Управление видео
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                style={{
                  minHeight: 44,
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--color-ink)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <LayoutDashboard size={20} aria-hidden />
                Админ панель
              </Link>
            </div>
          </div>
        </>
      )}
    </AdminPage>
  );
}
