'use client';

// График-волна недельной нагрузки — в стиле логотипа «Треньки» (плавная
// волнистая линия). Каждый день недели — точка на своей высоте:
//   Заряжен = 4 (пик), В тонусе = 3, Устал = 2, Разминка/Растяжка = 1.
// Линия рисуется анимированно (как роспись), подписи появляются по очереди.
//
// По умолчанию показывает каноническую неделю (для экрана «Готовим неделю»).
// Может принимать произвольные точки (для реального плана в календаре).

export interface WavePoint {
  label: string;
  height: number; // 1..4
  side: 'top' | 'bottom'; // где подпись относительно точки
}

// Каноническая неделя (как в макете CEO): Пн В тонусе(3) · Вт Зарядка(1) ·
// Ср Заряжен(4) · Чт Растяжка(1) · Пт Устал(2).
export const CANONICAL_WEEK: WavePoint[] = [
  { label: 'В тонусе', height: 3, side: 'top' },
  { label: 'Зарядка', height: 1, side: 'bottom' },
  { label: 'Заряжен', height: 4, side: 'top' },
  { label: 'Растяжка', height: 1, side: 'bottom' },
  { label: 'Устал', height: 2, side: 'top' },
];

interface Props {
  points?: WavePoint[];
  /** цвет линии */
  stroke?: string;
  /** запустить анимацию рисования */
  animate?: boolean;
}

const VB_W = 360;
const VB_H = 190;
const PAD_X = 40;
const Y_TOP = 52; // высота 4
const Y_BOTTOM = 138; // высота 1

function yForHeight(h: number): number {
  const clamped = Math.max(1, Math.min(4, h));
  return Y_BOTTOM - ((clamped - 1) / 3) * (Y_BOTTOM - Y_TOP);
}

// Плавная кривая через точки (Catmull-Rom → cubic bezier) — даёт «волну» лого.
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function MicrocycleWave({
  points = CANONICAL_WEEK,
  stroke = '#9FB87A',
  animate = true,
}: Props) {
  const n = points.length;
  const step = n > 1 ? (VB_W - PAD_X * 2) / (n - 1) : 0;
  const coords = points.map((p, i) => ({
    x: PAD_X + i * step,
    y: yForHeight(p.height),
    ...p,
  }));
  const path = smoothPath(coords);

  // Длительность прохода линии — для синхронной подачи подписей.
  const drawDur = 1.8;

  return (
    <div className="w-full" style={{ maxWidth: 460 }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        {/* Линия-волна */}
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          className={animate ? 'mc-wave-line' : undefined}
          style={{
            filter: `drop-shadow(0 0 6px ${stroke}55)`,
          }}
        />

        {coords.map((c, i) => {
          const delay = (i / Math.max(1, n - 1)) * drawDur * 0.85 + 0.15;
          const labelY = c.side === 'top' ? c.y - 16 : c.y + 26;
          return (
            <g
              key={c.label + i}
              className={animate ? 'mc-wave-pt' : undefined}
              style={animate ? { animationDelay: `${delay}s` } : undefined}
            >
              <circle cx={c.x} cy={c.y} r={4} fill={stroke} />
              <circle cx={c.x} cy={c.y} r={7} fill="none" stroke={stroke} strokeWidth={1} opacity={0.4} />
              <text
                x={c.x}
                y={labelY}
                textAnchor="middle"
                fill="#F9F8FE"
                style={{
                  fontFamily: 'Overpass, sans-serif',
                  fontWeight: 800,
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                }}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        .mc-wave-line {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: mcWaveDraw ${drawDur}s ease-out forwards;
        }
        .mc-wave-pt {
          opacity: 0;
          animation: mcWavePt 0.5s ease-out forwards;
        }
        @keyframes mcWaveDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes mcWavePt {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
