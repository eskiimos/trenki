'use client';

// Блок «Потенциал» — 5 характеристик в виде кругов слева, большое кольцо
// общего потенциала справа. Pure CSS + inline-SVG, без svg-файлов из /icons.
//
// Раньше жил inline в src/app/profile/page.tsx. Вынесен в общий компонент,
// чтобы тот же блок использовался в /coach/athletes/[id] — у тренера и
// атлета один и тот же визуал «состояния игрока».
//
// Поведение не меняется — это чистый extract из profile/page.tsx:16-296.

export interface PotentialSectionProps {
  ratingEndurance?: number;
  ratingTechnique?: number;
  ratingPower?: number;
  ratingSpeed?: number;
  ratingFlexibility?: number;
  potential?: number;
  gains?: {
    endurance?: number;
    technique?: number;
    power?: number;
    speed?: number;
    flexibility?: number;
  };
}

// Цвет в зависимости от значения потенциала (0-20 → orange, 20-50 → orange→yellow, 50-70 → yellow→green, 70+ → green)
function potentialColor(p: number): string {
  if (p <= 0) return '#AEABBB';
  if (p <= 20) return '#FF8C4A';
  if (p <= 50) {
    const t = (p - 20) / 30;
    const g = Math.round(140 + (201 - 140) * t);
    return `rgb(255,${g},74)`;
  }
  if (p < 70) {
    const t = (p - 50) / 20;
    const r = Math.round(255 + (161 - 255) * t);
    const g = Math.round(201 + (255 - 201) * t);
    return `rgb(${r},${g},74)`;
  }
  return '#A1FF4A';
}

interface CharRowProps {
  label: string;
  value?: number;
  gain?: number;
  /** отступ справа — круг сдвигается влево, линия становится короче */
  insetRight: number;
}

function CharRow({ label, value, gain, insetRight }: CharRowProps) {
  const hasValue = typeof value === 'number' && !Number.isNaN(value) && value > 0;
  const display = hasValue ? value!.toFixed(1) : '–';
  const hasGain = typeof gain === 'number' && !Number.isNaN(gain) && gain > 0;

  return (
    <div
      className="flex items-center"
      style={{ paddingRight: insetRight }}
    >
      <div
        className="text-white uppercase select-none shrink-0"
        style={{
          fontFamily: 'Overpass, sans-serif',
          fontWeight: 800,
          fontSize: 12,
          letterSpacing: '0.5px',
          lineHeight: '100%',
        }}
      >
        {label}
      </div>

      {/* Соединительная линия — растягивается на оставшееся место */}
      <div
        style={{
          flex: 1,
          minWidth: 8,
          height: 1,
          background: 'linear-gradient(90deg, rgba(68,92,255,0) 0%, rgba(68,92,255,0.5) 50%, rgba(68,92,255,0.9) 100%)',
          marginLeft: 6,
          marginRight: -1,
        }}
      />

      {/* Маленький круг с числом */}
      <div className="relative shrink-0" style={{ width: 56, height: 56, zIndex: 2 }}>
        <svg viewBox="0 0 56 56" className="absolute inset-0 w-full h-full">
          {/* Внешнее тонкое кольцо */}
          <circle cx="28" cy="28" r="26" fill="none" stroke="#445CFF" strokeWidth="1.5" opacity="0.7" />
          {/* Внутренний slight glow */}
          <circle cx="28" cy="28" r="22" fill="rgba(68,92,255,0.06)" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hasGain && (
            <span
              className="font-overpass"
              style={{
                color: '#A1FF4A',
                fontWeight: 700,
                fontSize: 9,
                lineHeight: '100%',
                marginBottom: 1,
              }}
            >
              +{gain!.toFixed(1)}
            </span>
          )}
          <span
            className="font-overpass"
            style={{
              color: hasValue ? '#445CFF' : '#AEABBB',
              fontWeight: 900,
              fontSize: hasValue ? 16 : 18,
              lineHeight: '100%',
            }}
          >
            {display}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PotentialSection({
  ratingEndurance,
  ratingTechnique,
  ratingPower,
  ratingSpeed,
  ratingFlexibility,
  potential,
  gains,
}: PotentialSectionProps) {
  const p = potential || 0;
  const ringColor = potentialColor(p);

  // Большое кольцо
  const RING_SIZE = 144;
  const RING_RADIUS = 60;          // основное кольцо
  const RING_INNER_RADIUS = 52;    // декоративное внутреннее
  const RING_OUTER_RADIUS = 68;    // декоративное внешнее
  const DOTS_RADIUS = 72;          // радиус, на котором сидят точки
  const RING_CIRC = 2 * Math.PI * RING_RADIUS;

  // 10 точек — делят круг на 10 секторов (каждая = 10 единиц потенциала)
  const DOT_COUNT = 10;
  const dots = Array.from({ length: DOT_COUNT }, (_, i) => {
    const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2; // старт сверху
    const x = RING_SIZE / 2 + DOTS_RADIUS * Math.cos(angle);
    const y = RING_SIZE / 2 + DOTS_RADIUS * Math.sin(angle);
    return { x, y, key: i };
  });

  // Порядок согласно Figma: Выносливость, Техника, Сила, Скорость, Гибкость
  // insetRight: дуга, выгнутая ВЛЕВО (как ")"). Сила в центре имеет
  // самую короткую линию (круг ближе к лейблу), крайние строки — длиннее.
  const rows: CharRowProps[] = [
    { label: 'выносливость', value: ratingEndurance,   gain: gains?.endurance,   insetRight: 0  },
    { label: 'техника',      value: ratingTechnique,   gain: gains?.technique,   insetRight: 24 },
    { label: 'сила',         value: ratingPower,       gain: gains?.power,       insetRight: 40 },
    { label: 'скорость',     value: ratingSpeed,       gain: gains?.speed,       insetRight: 24 },
    { label: 'гибкость',     value: ratingFlexibility, gain: gains?.flexibility, insetRight: 0  },
  ];

  return (
    <div
      className="relative"
      style={{
        backgroundColor: '#060919',
        borderRadius: 12,
        padding: '18px 16px',
      }}
    >
      <div className="flex items-stretch gap-2">
        {/* Левая колонка — 5 характеристик */}
        <div className="flex-1 flex flex-col justify-between" style={{ minHeight: RING_SIZE + 32, gap: 10 }}>
          {rows.map((r) => (
            <CharRow key={r.label} {...r} />
          ))}
        </div>

        {/* Правая часть — большое кольцо */}
        <div className="relative shrink-0 self-center" style={{ width: RING_SIZE, height: RING_SIZE, zIndex: 1 }}>
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Внешнее декоративное тонкое кольцо */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_OUTER_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="1"
              opacity="0.35"
            />
            {/* Внутреннее декоративное тонкое кольцо */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_INNER_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="1"
              opacity="0.35"
            />
            {/* Базовое тёмное кольцо (фон под прогресс) */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#1F2540"
              strokeWidth="6"
            />
            {/* Полоса заполнения */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(p / 100) * RING_CIRC} ${RING_CIRC}`}
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.6s ease' }}
            />
          </svg>

          {/* Декоративные точки — 10 шт, делят кольцо на 10 секторов */}
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {dots.map((d) => (
              <circle
                key={d.key}
                cx={d.x}
                cy={d.y}
                r={2}
                fill={ringColor}
                opacity={0.55}
              />
            ))}
          </svg>

          {/* Внутренний контент */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-overpass"
              style={{
                color: ringColor,
                fontWeight: 900,
                fontSize: 32,
                lineHeight: '100%',
                transition: 'color 0.6s ease',
              }}
            >
              {p > 0 ? p.toFixed(1) : '–'}
            </div>
            <div
              className="font-overpass uppercase italic mt-1 text-center"
              style={{
                color: '#F9F8FE',
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: '0.5px',
                lineHeight: '110%',
              }}
            >
              общий
              <br />
              потенциал
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
