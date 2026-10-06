'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { AdminButton, AdminCard, SectionTitle, inputStyle } from '@/components/admin/ui';
import { frameIndexAt } from '@/lib/pose/reference';
import {
  accumulateAssessmentSample, assessmentSampleDuration, createAssessmentAccumulator, evaluatePoseAssessment,
  prepareAssessmentReference, summarizeAssessment,
} from '@/lib/pose/assessment';
import { containRect, drawSkeleton } from './draw';
import { loadAssessmentReference } from './reference-client';
import { usePoseCamera } from './usePoseCamera';

type LoadedReference = Awaited<ReturnType<typeof loadAssessmentReference>>;
type Assessment = ReturnType<typeof evaluatePoseAssessment>;
type Phase = 'ready' | 'running' | 'paused' | 'finished';
const emptySummary = () => summarizeAssessment(createAssessmentAccumulator());
const percent = (value: number | null) => value === null ? '—' : `${Math.round(value)}%`;
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export default function LiveAssessment({ videoId }: { videoId: string }) {
  const [loaded, setLoaded] = useState<LoadedReference | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [live, setLive] = useState<Assessment | null>(null);
  const [summary, setSummary] = useState(emptySummary);
  const [message, setMessage] = useState<string | null>(null);
  const [sideMode, setSideMode] = useState<'same' | 'opposite'>('opposite');
  const [delayMs, setDelayMs] = useState(500);
  const [buffering, setBuffering] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const trainerRef = useRef<HTMLVideoElement>(null);
  const trainerCanvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('ready');
  const bufferingRef = useRef(false);
  const clockRef = useRef<{ mediaMs: number; capturedAtMs: number } | null>(null);
  const accumulatorRef = useRef(createAssessmentAccumulator());
  const prepared = useMemo(() => loaded ? prepareAssessmentReference(loaded.doc, loaded.detail.reference?.segments ?? []) : null, [loaded]);

  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const markBuffering = useCallback((next: boolean) => { bufferingRef.current = next; setBuffering(next); }, []);
  const pause = useCallback(() => {
    trainerRef.current?.pause();
    clockRef.current = null;
    setLive(null);
    if (phaseRef.current === 'running') changePhase('paused');
  }, [changePhase]);
  const resetScore = useCallback(() => {
    accumulatorRef.current = createAssessmentAccumulator();
    clockRef.current = null;
    setSummary(emptySummary());
    setLive(null);
  }, []);

  const { videoRef: cameraVideoRef, canvasRef: cameraCanvasRef, status: cameraStatus, error: cameraError, start: startCamera, stop: stopCamera } = usePoseCamera({
    onFrame: (frame, capturedAtMs) => {
      const video = trainerRef.current;
      if (!prepared || !video || phaseRef.current !== 'running' || bufferingRef.current || video.paused || video.seeking || video.readyState < 3) {
        clockRef.current = null;
        return;
      }
      // Inference is synchronous. Compare the camera snapshot with the media
      // position at capture, rather than the later position after inference.
      const mediaMs = video.currentTime * 1000 - Math.max(0, performance.now() - capturedAtMs) * video.playbackRate;
      const result = evaluatePoseAssessment(prepared, frame, mediaMs - delayMs, sideMode);
      const current = { mediaMs, capturedAtMs };
      const elapsed = assessmentSampleDuration(clockRef.current, current, video.playbackRate);
      clockRef.current = current;
      // A jump in the playback clock is a seek, never extra time spent exercising.
      if (elapsed > 0) accumulateAssessmentSample(accumulatorRef.current, result, elapsed);
      setLive(result);
      setSummary(summarizeAssessment(accumulatorRef.current));
    },
    onUnavailable: () => {
      pause();
      setMessage('Тренировка на паузе. Проверьте камеру и нажмите «Продолжить»');
    },
  });

  useEffect(() => {
    const controller = new AbortController();
    loadAssessmentReference(videoId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setLoaded(data); })
      .catch((e: unknown) => { if (!controller.signal.aborted) setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить эталон'); });
    return () => { controller.abort(); };
  }, [videoId, retry]);

  // The trainer overlay follows the media clock, including pauses and seeks.
  useEffect(() => {
    if (!loaded) return;
    let raf = 0;
    let previous = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = trainerRef.current;
      const canvas = trainerCanvasRef.current;
      if (!video || !canvas) return;
      const ms = video.currentTime * 1000;
      const index = frameIndexAt(loaded.doc.frames, ms);
      const dpr = window.devicePixelRatio || 1;
      const w = video.clientWidth, h = video.clientHeight;
      const signature = `${index}:${w}:${h}:${dpr}`;
      if (signature === previous) return;
      previous = signature;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const frame = loaded.doc.frames[index];
        drawSkeleton(ctx, frame && Math.abs(frame[0] - ms) <= 150 ? frame : undefined,
          containRect(w, h, video.videoWidth || loaded.doc.width, video.videoHeight || loaded.doc.height), dpr);
      }
      setPositionMs(ms);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  const finish = () => {
    trainerRef.current?.pause();
    clockRef.current = null;
    changePhase('finished');
    setLive(null);
    markBuffering(false);
    stopCamera();
  };

  const start = async () => {
    const video = trainerRef.current;
    if (!video || !loaded || !prepared || cameraStatus !== 'ready') return;
    setMessage(null);
    if (phase === 'finished' || video.ended) {
      resetScore();
      video.currentTime = 0;
    }
    clockRef.current = null;
    changePhase('running');
    try { await video.play(); }
    catch { pause(); setMessage('Не удалось запустить видео. Проверьте соединение и попробуйте снова'); }
  };

  const segments = loaded?.detail.reference?.segments ?? [];
  const canStart = !!prepared && !!segments.length && videoReady && cameraStatus === 'ready';
  const optionsLocked = phase === 'running' || phase === 'paused';
  const statusText = phase === 'finished' ? 'Тест завершён'
    : phase === 'paused' ? 'Пауза'
    : buffering && phase === 'running' ? 'Видео загружается — оценка на паузе'
    : phase === 'running' ? live?.message || 'Определяю положение тела…'
    : cameraStatus === 'ready' ? 'Встаньте так, чтобы камера видела всё тело, и запустите тренировку'
    : 'Включите камеру, затем запустите тренировку';

  if (loadError) return <AdminCard tone="danger" role="alert">
    <p style={{ margin: '0 0 12px' }}>{loadError}</p>
    <div className="flex flex-wrap gap-3">
      <AdminButton tone="secondary" onClick={() => { setLoadError(null); setLoaded(null); setRetry((n) => n + 1); }}>Попробовать снова</AdminButton>
      <Link href={`/admin/pose/${videoId}`} style={{ color: 'var(--color-brand)' }}>Открыть эталон</Link>
    </div>
  </AdminCard>;
  if (!loaded) return <p role="status" style={{ color: 'var(--color-muted)' }}>Загружаю видео и эталон…</p>;

  return <div className="flex flex-col gap-4">
    <AdminCard>
      <SectionTitle>Выбранное занятие</SectionTitle>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{loaded.detail.video.title}</div>
      <p style={{ color: 'var(--color-muted)', margin: '8px 0 0', fontSize: 13 }}>
        Повторяйте движения тренера. Оценка идёт только в рабочих отрезках; объяснения и паузы не учитываются.
        Камера обрабатывается на вашем устройстве, запись не отправляется на сервер.
      </p>
      {!segments.length && <p role="alert" style={{ color: 'var(--color-danger)', marginBottom: 0 }}>
        В эталоне нет рабочих отрезков. <Link href={`/admin/pose/${videoId}`} style={{ textDecoration: 'underline' }}>Разметьте упражнение в эталоне</Link>, затем откройте тест заново.
      </p>}
    </AdminCard>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VideoPanel label={`Тренер · ${time(positionMs)} / ${time(loaded.doc.durationMs)}`}>
        <video ref={trainerRef} src={loaded.detail.playbackUrl} controls playsInline preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onLoadedMetadata={() => setVideoReady(true)}
          onError={() => { setVideoReady(false); pause(); setMessage('Не удалось загрузить видео. Откройте тест заново, чтобы обновить ссылку'); }}
          onPlay={() => {
            if (cameraStatus !== 'ready' || !segments.length) { trainerRef.current?.pause(); return; }
            if (phaseRef.current === 'finished') resetScore();
            changePhase('running');
          }}
          onPause={pause}
          onWaiting={() => { markBuffering(true); clockRef.current = null; setLive(null); }}
          onPlaying={() => markBuffering(false)}
          onSeeking={() => { clockRef.current = null; resetScore(); setMessage('После перемотки оценка считается заново'); }}
          onEnded={finish}
        />
        <canvas ref={trainerCanvasRef} style={overlayStyle} />
      </VideoPanel>
      <VideoPanel label="Ваша камера · зеркальное изображение">
        <video ref={cameraVideoRef} muted autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }} />
        <canvas ref={cameraCanvasRef} style={{ ...overlayStyle, transform: 'scaleX(-1)' }} />
        {cameraStatus !== 'ready' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-muted)', padding: 20, textAlign: 'center' }}>
          {cameraStatus === 'loading' ? 'Включаю камеру и загружаю распознавание…' : 'Камера выключена'}
        </div>}
      </VideoPanel>
    </div>

    <AdminCard tone={phase === 'running' && live?.score !== null && live?.score !== undefined ? 'accent' : 'default'}>
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div>
          <SectionTitle>{phase === 'finished' ? 'Результат занятия' : 'Текущая оценка'}</SectionTitle>
          <div data-testid="live-score" style={{ fontSize: 48, fontWeight: 800, color: 'var(--color-brand)', lineHeight: 1 }}>
            {percent(phase === 'finished' ? summary.score : phase === 'running' ? live?.score ?? null : null)}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Metric label="Оценка занятия" value={percent(summary.score)} />
          <Metric label="Сходство видимых поз" value={percent(summary.similarityScore)} />
          <Metric label="Покрытие оценки" value={summary.activeMs ? `${Math.round(summary.coverageRatio * 100)}%` : '—'} />
          <Metric label="Рабочее время" value={time(summary.activeMs)} />
        </div>
      </div>
      <p role="status" style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 0' }}>{statusText}</p>
      {!!live?.feedback.length && phase === 'running' && <div className="flex flex-wrap gap-3" style={{ marginTop: 12 }}>
        {live.feedback.map((item) => <span key={item.group} style={{ border: '1px solid var(--border-hairline)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>
          {item.label}: {percent(item.score)}
        </span>)}
      </div>}
      {phase === 'finished' && summary.activeMs === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Вы не дошли до рабочего отрезка с пригодным эталоном. Итоговой оценки пока нет.</p>}
      <p style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 0 }}>
        Экспериментальная оценка сходства поз по углам суставов. Итог учитывает видимость тела: пропущенные камерой движения снижают результат.
        Ракурс и освещение влияют на точность; это тест алгоритма, а не оценка тренера.
      </p>
    </AdminCard>

    {(cameraError || message) && <AdminCard tone={cameraError ? 'danger' : 'default'} role={cameraError ? 'alert' : 'status'}>
      {cameraError || message}
    </AdminCard>}
    <div className="flex flex-wrap gap-3">
      {cameraStatus === 'off' && <AdminButton icon={Camera} disabled={!segments.length} onClick={() => void startCamera()}>Включить камеру</AdminButton>}
      <AdminButton icon={Play} disabled={!canStart || phase === 'running'} onClick={() => void start()}>
        {phase === 'running' ? 'Тренировка идёт' : phase === 'paused' ? 'Продолжить' : phase === 'finished' ? 'Новая тренировка' : 'Запустить тренировку'}
      </AdminButton>
      {phase === 'running' && <AdminButton tone="secondary" icon={Pause} onClick={pause}>Пауза</AdminButton>}
      {(phase === 'running' || phase === 'paused') && <AdminButton tone="secondary" icon={Square} onClick={finish}>Завершить</AdminButton>}
      {cameraStatus !== 'off' && <AdminButton tone="secondary" icon={CameraOff} onClick={() => { pause(); stopCamera(); }}>Выключить камеру</AdminButton>}
      {phase !== 'running' && <AdminButton tone="secondary" icon={RotateCcw} onClick={() => {
        resetScore(); changePhase('ready'); setMessage(null); const v = trainerRef.current; if (v) v.currentTime = 0;
      }}>Сбросить тест</AdminButton>}
    </div>
    <AdminCard>
      <SectionTitle>Как повторять движения</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label style={{ fontSize: 13 }}>Стороны тела
          <select aria-label="Стороны тела" value={sideMode} disabled={optionsLocked} onChange={(e) => { setSideMode(e.target.value as 'same' | 'opposite'); resetScore(); }} style={{ ...inputStyle, marginTop: 6 }}>
            <option value="opposite">Зеркально, как перед тренером</option>
            <option value="same">Та же сторона тела, что у тренера</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>Время на повтор движения: {(delayMs / 1000).toFixed(1)} с
          <input aria-label="Задержка повторения движения" type="range" min={0} max={1500} step={100} value={delayMs} disabled={optionsLocked}
            onChange={(e) => { setDelayMs(Number(e.target.value)); resetScore(); }} style={{ width: '100%', marginTop: 16, accentColor: 'var(--color-brand)' }} />
        </label>
      </div>
      <p style={{ color: 'var(--color-muted)', fontSize: 13, marginBottom: 0 }}>Поставьте камеру на уровне таза, отойдите так, чтобы были видны руки и стопы. По возможности повторите ракурс тренера.</p>
    </AdminCard>
  </div>;
}

const overlayStyle = { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', pointerEvents: 'none' as const };
function VideoPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 8 }}>{label}</div>
    <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>{children}</div>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div><div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div></div>;
}
