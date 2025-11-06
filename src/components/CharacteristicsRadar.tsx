'use client';

interface CharacteristicsRadarProps {
  characteristics: {
    ratingPower: number;
    ratingSpeed: number;
    ratingEndurance: number;
    ratingTechnique: number;
    ratingFlexibility: number;
  };
}

export default function CharacteristicsRadar({ characteristics }: CharacteristicsRadarProps) {
  const data = [
    { label: '💪 Сила', value: characteristics.ratingPower, angle: 0 },
    { label: '⚡ Скорость', value: characteristics.ratingSpeed, angle: 72 },
    { label: '🫀 Выносливость', value: characteristics.ratingEndurance, angle: 144 },
    { label: '🎯 Техника', value: characteristics.ratingTechnique, angle: 216 },
    { label: '🤸 Гибкость', value: characteristics.ratingFlexibility, angle: 288 },
  ];

  const size = 280;
  const center = size / 2;
  const maxRadius = size / 2 - 40;
  const levels = 5; // 5 уровней: 20, 40, 60, 80, 100

  // Вычисляем точки многоугольника
  const calculatePoint = (value: number, angle: number) => {
    const radius = (value / 100) * maxRadius;
    const radians = ((angle - 90) * Math.PI) / 180; // -90 чтобы начинать сверху
    return {
      x: center + radius * Math.cos(radians),
      y: center + radius * Math.sin(radians),
    };
  };

  // Точки для заполненной области
  const dataPoints = data.map(d => calculatePoint(d.value, d.angle));
  const pathData = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';

  // Цвет на основе среднего значения
  const avgValue = data.reduce((sum, d) => sum + d.value, 0) / data.length;
  const getColor = () => {
    if (avgValue >= 80) return '#A1FF4A';
    if (avgValue >= 60) return '#FFD700';
    if (avgValue >= 40) return '#FFA500';
    return '#FF6B6B';
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg width={size} height={size} className="drop-shadow-lg">
        {/* Фоновые круги (уровни) */}
        {Array.from({ length: levels }).map((_, i) => {
          const radius = (maxRadius / levels) * (i + 1);
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Оси к каждой вершине */}
        {data.map((d, i) => {
          const endPoint = calculatePoint(100, d.angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Заполненная область - градиент */}
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={getColor()} stopOpacity="0.4" />
            <stop offset="100%" stopColor={getColor()} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Заполненный многоугольник */}
        <path
          d={pathData}
          fill="url(#radarGradient)"
          stroke={getColor()}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Точки на вершинах */}
        {dataPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={getColor()}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Легенда */}
      <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between bg-[#1a1f35] rounded-lg px-3 py-2">
            <span className="text-sm text-[#AEABBB]">{d.label}</span>
            <span className="text-white font-bold text-sm">{d.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
