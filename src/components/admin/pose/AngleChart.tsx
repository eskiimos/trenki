'use client';

// График угла сустава во времени (эталон движений). Одна ось Y в градусах,
// левая и правая сторона — две линии (цвета проверены валидатором палитры на
// фоне админки: #3987e5 / #d95926). Разрывы линии — кадры, где сустав не виден.
// Наведение — перекрестие и подсказка, клик — перемотка видео, вертикальная
// линия — текущий момент видео.

import { useEffect, useMemo, useRef, useState } from 'react';

export interface AngleSeries {
  label: string;
  color: string;
  values: Array<number | null>;
}

const H = 150;
const PAD = { l: 36, r: 8, t: 8, b: 22 };
const MAX_POINTS = 600;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Сжатие до MAX_POINTS: среднее по корзине без пропусков, пусто — разрыв. */
function downsample(times: number[], values: Array<number | null>) {
  const n = times.length;
  const k = Math.max(1, Math.ceil(n / MAX_POINTS));
  const t: number[] = [];
  const v: Array<number | null> = [];
  for (let i = 0; i < n; i += k) {
    let sum = 0;
    let cnt = 0;
    for (let j = i; j < Math.min(n, i + k); j++) {
      const x = values[j];
      if (x != null) {
        sum += x;
        cnt++;
      }
    }
    t.push(times[Math.min(n - 1, i + Math.floor(k / 2))]!);
    v.push(cnt ? sum / cnt : null);
  }
  return { t, v };
}

export default function AngleChart({
  title,
  times,
  series,
  yMax,
  yTicks,
  currentMs,
  durationMs,
  onSeek,
}: {
  title: string;
  times: number[];
  series: AngleSeries[];
  yMax: number;
  yTicks: number[];
  currentMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ ms: number; px: number } | null>(null);
  // Ширина в пикселях = ширине viewBox: без растяжения текста и линий
  const [W, setW] = useState(800);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const x = (ms: number) => PAD.l + (Math.max(0, Math.min(durationMs, ms)) / Math.max(1, durationMs)) * (W - PAD.l - PAD.r);
  const y = (deg: number) => PAD.t + (1 - Math.max(0, Math.min(yMax, deg)) / yMax) * (H - PAD.t - PAD.b);

  const paths = useMemo(
    () =>
      series.map((s) => {
        const { t, v } = downsample(times, s.values);
        let d = '';
        let pen = false;
        for (let i = 0; i < t.length; i++) {
          const val = v[i];
          if (val == null) {
            pen = false;
            continue;
          }
          d += `${pen ? 'L' : 'M'}${x(t[i]!).toFixed(1)} ${y(val).toFixed(1)}`;
          pen = true;
        }
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [times, series, yMax, durationMs, W],
  );

  const xTicks = useMemo(() => {
    const out: number[] = [];
    const step = durationMs / 5;
    for (let i = 0; i <= 5; i++) out.push(Math.round(i * step));
    return out;
  }, [durationMs]);

  const msFromEvent = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    const ms = ((vx - PAD.l) / (W - PAD.l - PAD.r)) * durationMs;
    if (ms < 0 || ms > durationMs) return null;
    return { ms, px: clientX - r.left };
  };

  // Значения под курсором — ближайший кадр
  const hoverValues = useMemo(() => {
    if (!hover || times.length === 0) return null;
    let lo = 0;
    let hi = times.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid]! < hover.ms) lo = mid + 1;
      else hi = mid;
    }
    return series.map((s) => s.values[lo] ?? null);
  }, [hover, times, series]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{title}</div>
        {series.length > 1 && (
          <div className="flex items-center gap-3" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {series.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span aria-hidden style={{ width: 14, height: 2, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}: угол в градусах по времени видео`}
          style={{ width: '100%', height: H, display: 'block', cursor: 'pointer' }}
          onMouseMove={(e) => setHover(msFromEvent(e.clientX))}
          onMouseLeave={() => setHover(null)}
          onClick={(e) => {
            const h = msFromEvent(e.clientX);
            if (h) onSeek(h.ms);
          }}
        >
          {yTicks.map((d) => (
            <g key={d}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(d)} y2={y(d)} stroke="rgba(255,255,255,0.08)" vectorEffect="non-scaling-stroke" />
              <text x={PAD.l - 6} y={y(d) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
                {d}°
              </text>
            </g>
          ))}
          {xTicks.map((ms, i) => (
            <text
              key={ms}
              x={x(ms)}
              y={H - 6}
              // Крайние подписи — внутрь графика, иначе «0:45» обрезается
              textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}
              fontSize="11"
              fill="var(--color-muted)"
            >
              {mmss(ms)}
            </text>
          ))}
          {paths.map((d, i) => (
            <path
              key={series[i]!.label}
              d={d}
              fill="none"
              stroke={series[i]!.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Текущий момент видео */}
          <line x1={x(currentMs)} x2={x(currentMs)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-brand)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {hover && (
            <line x1={x(hover.ms)} x2={x(hover.ms)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {hover && hoverValues && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: Math.min(hover.px + 12, (svgRef.current?.clientWidth ?? 300) - 150),
              pointerEvents: 'none',
              background: 'var(--color-night)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: 'var(--color-muted)' }}>{mmss(hover.ms)}</div>
            {series.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: s.color, display: 'inline-block' }} />
                <span>
                  {s.label}: {hoverValues[i] != null ? `${hoverValues[i]}°` : 'не видно'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
