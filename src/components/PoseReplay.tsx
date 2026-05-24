'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  sessionId: string;
  /** Открыт ли плеер — модель загружаем только когда нужно */
  open: boolean;
}

const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

interface SessionPayload {
  id: string;
  fps: number | null;
  durationSec: number;
  framesCount: number;
  frames: number[][] | null;
}

/**
 * Скачивает gzip-сжатый JSON с Cloudinary и распаковывает через нативный
 * DecompressionStream (поддерживается всеми текущими браузерами и iOS Safari 16+).
 */
async function fetchPoseFramesFromUrl(url: string): Promise<number[][]> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`pose frames fetch: HTTP ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds: any = new (globalThis as any).DecompressionStream('gzip');
  const stream = res.body.pipeThrough(ds);
  const text = await new Response(stream).text();
  const doc = JSON.parse(text) as { fps?: number | null; frames?: unknown };
  return Array.isArray(doc.frames) ? (doc.frames as number[][]) : [];
}

/**
 * Воспроизведение записанного скелета атлета для тренера.
 * Кадр: [t_ms, x0,y0,v0, x1,y1,v1, ...] (x,y *1000 -> int; v *100 -> int).
 */
export default function PoseReplay({ sessionId, open }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const framesRef = useRef<number[][]>([]);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  // Загружаем данные сессии один раз при открытии
  useEffect(() => {
    if (!open || session || loading) return;
    let cancelled = false;
    setLoading(true);
    // Таймаут на случай если эндпоинт ещё не задеплоен или висит
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    (async () => {
      try {
        const r = await fetch(`/api/pose-sessions/${sessionId}`, { signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        if (!data?.session) {
          setError('Сессия не найдена');
          return;
        }
        const s = data.session as SessionPayload & {
          frames?: unknown;
          framesUrl?: string | null;
          framesEncoding?: string | null;
        };

        // Новые сессии — кадры лежат в Cloudinary, бэкенд дал signed URL.
        // Старые (до бэкфилла) — frames приходят inline в `frames`.
        let frames: number[][] = [];
        if (s.framesUrl) {
          try {
            frames = await fetchPoseFramesFromUrl(s.framesUrl);
          } catch (e) {
            if (!cancelled) {
              setError('Не удалось загрузить запись скелета');
            }
            console.error('pose frames fetch failed', e);
            return;
          }
        } else if (Array.isArray(s.frames)) {
          frames = s.frames as number[][];
        }
        if (cancelled) return;

        framesRef.current = frames;
        setSession({
          id: s.id,
          fps: s.fps ?? null,
          durationSec: s.durationSec,
          framesCount: s.framesCount,
          frames,
        });
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { name?: string; message?: string };
        if (err?.name === 'AbortError') {
          setError('Превышено время ожидания. Возможно, сервер ещё не обновлён.');
        } else {
          setError(err?.message || 'Ошибка загрузки');
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, sessionId, session, loading]);

  // Цикл воспроизведения
  useEffect(() => {
    if (!playing) return;
    const frames = framesRef.current;
    if (!frames.length) return;
    const totalMs = frames[frames.length - 1][0] || 1;
    startedAtRef.current = performance.now() - progress * totalMs;

    function tick() {
      const elapsed = performance.now() - startedAtRef.current;
      if (elapsed >= totalMs) {
        setProgress(1);
        setPlaying(false);
        drawFrame(frames.length - 1);
        return;
      }
      // ищем ближайший кадр по времени
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid][0] < elapsed) lo = mid + 1;
        else hi = mid;
      }
      drawFrame(Math.max(0, lo - 1));
      setProgress(elapsed / totalMs);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  function drawFrame(idx: number) {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || !frames[idx]) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#060919';
    ctx.fillRect(0, 0, W, H);

    const frame = frames[idx];
    // landmarks начинаются с индекса 1 (0 = t_ms)
    const pts: { x: number; y: number; v: number }[] = [];
    for (let i = 1; i + 2 < frame.length; i += 3) {
      pts.push({
        x: (frame[i] / 1000) * W,
        y: (frame[i + 1] / 1000) * H,
        v: frame[i + 2] / 100,
      });
    }

    // связи
    ctx.strokeStyle = '#A1FF4A';
    ctx.lineWidth = 2;
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = pts[a];
      const pb = pts[b];
      if (!pa || !pb) continue;
      if (pa.v < 0.3 || pb.v < 0.3) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    // точки
    ctx.fillStyle = '#A1FF4A';
    for (const p of pts) {
      if (p.v < 0.3) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Первый кадр сразу при загрузке
  useEffect(() => {
    if (session && framesRef.current.length > 0) {
      drawFrame(0);
    }
  }, [session]);

  if (!open) return null;

  const hasFrames = !!session && framesRef.current.length > 0;

  return (
    <div
      style={{
        background: '#0A0E26',
        border: '1px solid #26252F',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
      }}
    >
      <div className="font-overpass mb-2" style={{ color: '#AEABBB', fontSize: 11, fontWeight: 700 }}>
        Запись движений
      </div>

      {loading && (
        <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 12 }}>
          Загрузка…
        </div>
      )}
      {error && (
        <div className="font-overpass" style={{ color: '#FF6B6B', fontSize: 12 }}>
          {error}
        </div>
      )}
      {session && !hasFrames && !loading && (
        <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 12 }}>
          Для этой сессии скелет не был записан (старая запись).
        </div>
      )}

      {hasFrames && (
        <>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              background: '#060919',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: 'scaleX(-1)', // зеркально, как видел атлет
              }}
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                if (progress >= 1) setProgress(0);
                setPlaying((p) => !p);
              }}
              className="font-overpass rounded-full px-3 py-1.5"
              style={{
                background: playing ? '#26252F' : '#A1FF4A',
                color: playing ? '#F9F8FE' : '#101530',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {playing ? 'Пауза' : progress >= 1 ? 'Заново' : 'Воспроизвести'}
            </button>
            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={(e) => {
                const v = Number(e.target.value) / 1000;
                setProgress(v);
                setPlaying(false);
                const frames = framesRef.current;
                if (!frames.length) return;
                const totalMs = frames[frames.length - 1][0] || 1;
                const targetMs = v * totalMs;
                let lo = 0;
                let hi = frames.length - 1;
                while (lo < hi) {
                  const mid = (lo + hi) >> 1;
                  if (frames[mid][0] < targetMs) lo = mid + 1;
                  else hi = mid;
                }
                drawFrame(Math.max(0, lo - 1));
              }}
              style={{ flex: 1, accentColor: '#A1FF4A' }}
            />
            <span className="font-overpass" style={{ color: '#AEABBB', fontSize: 10 }}>
              {Math.round(progress * (session?.durationSec || 0))}/{session?.durationSec || 0}с
            </span>
          </div>
          <div className="font-overpass mt-1" style={{ color: '#AEABBB', fontSize: 10 }}>
            {framesRef.current.length} кадров · {session?.fps ?? '?'} fps
          </div>
        </>
      )}
    </div>
  );
}
