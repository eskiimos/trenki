'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { AdminButton, AdminCard, SectionTitle, inputStyle } from '@/components/admin/ui';
import { frameIndexAt } from '@/lib/pose/reference';
import {
  accumulateAssessmentSample, assessmentSampleDuration, createAssessmentAccumulator, evaluatePoseAssessment,
  prepareAssessmentReference, summarizeAssessment, assessmentSettingsAt, assessmentSummaryReliability,
} from '@/lib/pose/assessment';
import { ASSESSMENT_PROFILES } from '@/lib/pose/assessment-settings';
import { advanceReadiness, checkAssessmentReadiness, initialReadiness } from '@/lib/pose/readiness';
import { containRect, drawSkeleton } from './draw';
import { loadAssessmentReference } from './reference-client';
import { usePoseCamera } from './usePoseCamera';

type LoadedReference = Awaited<ReturnType<typeof loadAssessmentReference>>;
type Assessment = ReturnType<typeof evaluatePoseAssessment>;
type Phase = 'ready' | 'preparing' | 'running' | 'paused' | 'finished';
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
  const [primingVideo, setPrimingVideo] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [readiness, setReadiness] = useState(initialReadiness);
  const readinessRef = useRef(initialReadiness());
  const trainerRef = useRef<HTMLVideoElement>(null);
  const trainerCanvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>('ready');
  const playbackIdRef = useRef(0);
  const preparationRef = useRef<{ priming: boolean; primed: boolean; returnPhase: Phase } | null>(null);
  const bufferingRef = useRef(false);
  const clockRef = useRef<{ mediaMs: number; capturedAtMs: number } | null>(null);
  const accumulatorRef = useRef(createAssessmentAccumulator());
  const prepared = useMemo(() => loaded ? prepareAssessmentReference(loaded.doc, loaded.detail.reference?.segments ?? []) : null, [loaded]);
  const clearReadiness = useCallback(() => { const next = initialReadiness(); readinessRef.current = next; setReadiness(next); }, []);

  const changePhase = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next); }, []);
  const markBuffering = useCallback((next: boolean) => { bufferingRef.current = next; setBuffering(next); }, []);
  const pause = useCallback(() => {
    playbackIdRef.current++;
    const preparation = preparationRef.current;
    preparationRef.current = null;
    setPrimingVideo(false);
    trainerRef.current?.pause();
    clockRef.current = null;
    setLive(null);
    if (phaseRef.current === 'running') changePhase('paused');
    else if (phaseRef.current === 'preparing') changePhase(preparation?.returnPhase ?? 'ready');
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
      if (prepared && video) {
        const settings = assessmentSettingsAt(prepared, phaseRef.current === 'finished' ? 0 : video.currentTime * 1000 - delayMs);
        const next = advanceReadiness(readinessRef.current, checkAssessmentReadiness(frame, settings, sideMode), capturedAtMs, JSON.stringify({ settings, sideMode }));
        readinessRef.current = next;
        setReadiness(next);
        if (phaseRef.current === 'preparing' && preparationRef.current?.primed && next.ready && !document.hidden) {
          // The same media element was unlocked by the preparation button tap.
          // Start only on a fresh camera frame after the complete countdown.
          preparationRef.current = null;
          const playbackId = playbackIdRef.current;
          clockRef.current = null;
          changePhase('running');
          void video.play().catch(() => {
            if (playbackIdRef.current !== playbackId) return;
            pause();
            setMessage('Браузер не разрешил автоматический запуск. Нажмите «Продолжить», затем снова отойдите в кадр.');
          });
        }
      }
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
      const wasTraining = phaseRef.current === 'running' || phaseRef.current === 'paused' || phaseRef.current === 'preparing';
      clearReadiness();
      pause();
      setMessage(wasTraining ? 'Запуск прерван. Проверьте камеру и снова нажмите кнопку подготовки или продолжения.' : 'Проверка готовности прервана. Включите камеру снова.');
    },
  });

  useEffect(() => {
    const video = trainerRef.current;
    const playbackId = playbackIdRef;
    const preparation = preparationRef;
    return () => { playbackId.current++; preparation.current = null; video?.pause(); };
  }, [loaded]);

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
    let lastPositionUpdate = -Infinity;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = trainerRef.current;
      const canvas = trainerCanvasRef.current;
      if (!video || !canvas) return;
      const ms = video.currentTime * 1000;
      if (performance.now() - lastPositionUpdate >= 100) {
        lastPositionUpdate = performance.now();
        setPositionMs(ms);
      }
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
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  const finish = () => {
    pause();
    clockRef.current = null;
    changePhase('finished');
    setLive(null);
    markBuffering(false);
    stopCamera();
    clearReadiness();
  };

  const start = async () => {
    const video = trainerRef.current;
    if (!video || !loaded || !prepared?.segments.length || cameraStatus !== 'ready'
      || phaseRef.current === 'running' || phaseRef.current === 'preparing') return;
    const returnPhase = phaseRef.current === 'paused' ? 'paused' : 'ready';
    setMessage(null);
    if (phaseRef.current === 'finished' || video.ended) {
      resetScore();
      video.currentTime = 0;
    }
    clearReadiness();
    clockRef.current = null;
    const playbackId = ++playbackIdRef.current;
    preparationRef.current = { priming: true, primed: false, returnPhase };
    setPrimingVideo(true);
    changePhase('preparing');
    try {
      // Call play directly in the tap handler, preserving mobile user activation.
      // Pause the unlocked element before waiting for the user to step away.
      await video.play();
      if (playbackIdRef.current !== playbackId) return;
      video.pause();
      preparationRef.current = { priming: false, primed: true, returnPhase };
      setPrimingVideo(false);
      clearReadiness();
    } catch {
      if (playbackIdRef.current !== playbackId) return;
      pause();
      setMessage('Не удалось подготовить видео. Проверьте соединение и нажмите кнопку запуска снова.');
    }
  };

  const segments = loaded?.detail.reference?.segments ?? [];
  // Preloading is a browser hint. Let the user's tap start loading/playback,
  // even if the trainer has not emitted loadedmetadata yet.
  const settings = prepared ? assessmentSettingsAt(prepared, phase === 'finished' ? 0 : positionMs - delayMs) : null;
  const canStart = !!settings && !!segments.length && cameraStatus === 'ready';
  const reliability = assessmentSummaryReliability(summary);
  const overallScore = reliability.reliable ? summary.score : null;
  const optionsLocked = phase === 'running' || phase === 'paused' || phase === 'preparing';
  const statusText = phase === 'finished' ? 'Тест завершён'
    : phase === 'paused' ? 'Пауза'
    : phase === 'preparing' ? primingVideo ? 'Подготавливаю видео…' : readiness.message
    : buffering && phase === 'running' ? 'Видео загружается — оценка на паузе'
    : phase === 'running' ? live?.message || 'Определяю положение тела…'
    : !segments.length ? 'Для оценки разметьте рабочие отрезки в эталоне. Камеру можно включить для проверки.'
    : cameraStatus === 'loading' ? 'Включаю камеру и загружаю распознавание…'
    : cameraStatus === 'ready' ? 'Нажмите «Подготовиться и начать», затем отойдите в кадр'
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
      {settings && <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Профиль оценки: {ASSESSMENT_PROFILES[settings.profile]} · допуск {settings.toleranceDeg}°. <Link href={`/admin/pose/${videoId}`} style={{ textDecoration: 'underline' }}>Настроить отрезки</Link></p>}
      {!segments.length && <p role="alert" style={{ color: 'var(--color-danger)', marginBottom: 0 }}>
        В эталоне нет рабочих отрезков. <Link href={`/admin/pose/${videoId}`} style={{ textDecoration: 'underline' }}>Разметьте упражнение в эталоне</Link>, затем откройте тест заново.
      </p>}
    </AdminCard>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <VideoPanel label={`Тренер · ${time(positionMs)} / ${time(loaded.doc.durationMs)}`}>
        <video ref={trainerRef} src={loaded.detail.playbackUrl} controls playsInline preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => { pause(); setMessage('Не удалось загрузить видео. Откройте тест заново, чтобы обновить ссылку'); }}
          onPlay={() => {
            // Native controls cannot skip the explicitly armed preparation.
            if (phaseRef.current !== 'running' && !preparationRef.current?.priming) trainerRef.current?.pause();
          }}
          onPause={() => { if (phaseRef.current === 'running') pause(); }}
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
        {cameraStatus === 'ready' && phase !== 'running' && segments.length > 0 && <div aria-hidden="true"
          style={{ position: 'absolute', top: 10, left: 10, right: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 700, pointerEvents: 'none' }}>
          {phase !== 'preparing' ? 'Нажмите кнопку подготовки и отойдите в кадр' : readiness.sinceMs !== null ? `Начинаем через ${readiness.secondsLeft}` : 'Проверьте положение перед камерой'}
        </div>}
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
            {percent(phase === 'finished' ? overallScore : phase === 'running' ? live?.score ?? null : null)}
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <Metric label="Оценка занятия" value={percent(overallScore)} />
          <Metric label="Сходство видимых поз" value={percent(summary.similarityScore)} />
          <Metric label="Покрытие оценки" value={summary.activeMs ? `${Math.round(summary.coverageRatio * 100)}%` : '—'} />
          <Metric label="Рабочее время" value={time(summary.activeMs)} />
          <Metric label="Достоверность данных" value={phase === 'finished' ? reliability.reliable ? 'Достаточно' : 'Недостаточно'
            : phase === 'running' ? live?.status === 'scored' ? 'Достаточно' : live?.status === 'inactive' ? 'Отдых' : 'Недостаточно' : '—'} />
        </div>
      </div>
      <p role="status" style={{ fontSize: 14, fontWeight: 600, margin: '16px 0 0' }}>{statusText}</p>
      {!!live?.feedback.length && phase === 'running' && <div className="flex flex-wrap gap-3" style={{ marginTop: 12 }}>
        {live.feedback.map((item) => <span key={item.group} style={{ border: '1px solid var(--border-hairline)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}>
          {item.label}: {percent(item.score)}
        </span>)}
      </div>}
      {phase === 'finished' && summary.activeMs === 0 && <p style={{ color: 'var(--color-muted)', fontSize: 13 }}>Вы не дошли до рабочего отрезка с пригодным эталоном. Итоговой оценки пока нет.</p>}
      {(summary.activeMs > 0 || summary.referenceUnavailableMs > 0 || phase === 'finished') && <div style={{ fontSize: 13, marginTop: 12 }}>
        <p role="status" style={{ color: reliability.reliable ? 'var(--color-brand)' : 'var(--color-muted)' }}>{reliability.message}</p>
        <div className="flex flex-wrap gap-4">
          <Metric label="Человек не распознан" value={time(summary.cameraMissingMs)} />
          <Metric label="Не хватало видимости суставов" value={time(summary.cameraPartialMs)} />
          <Metric label="Непригодные кадры эталона" value={time(summary.referenceUnavailableMs)} />
        </div>
      </div>}
      <p style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 0 }}>
        Экспериментальная оценка сходства поз по углам суставов. Итог учитывает видимость тела: пропущенные камерой движения снижают результат.
        Ракурс и освещение влияют на точность; это тест алгоритма, а не оценка тренера.
      </p>
    </AdminCard>

    {(cameraError || message) && <AdminCard tone={cameraError ? 'danger' : 'default'} role={cameraError ? 'alert' : 'status'}>
      {cameraError || message}
    </AdminCard>}
    {cameraStatus === 'ready' && phase !== 'running' && segments.length > 0 && <AdminCard tone={readiness.ready ? 'accent' : 'default'}>
      <SectionTitle>Проверка готовности · {settings && ASSESSMENT_PROFILES[settings.profile]}</SectionTitle>
      <div data-testid="readiness-status" role="status" style={{ fontSize: 16, fontWeight: 700 }}>
        {phase !== 'preparing' ? 'Нажмите кнопку подготовки' : primingVideo ? 'Подготавливаю видео…' : readiness.sinceMs !== null ? `Начинаем через ${readiness.secondsLeft}` : 'Проверьте положение перед камерой'}
      </div>
      <p style={{ fontSize: 13, marginBottom: 0 }}>{readiness.message}</p>
      <p style={{ color: 'var(--color-muted)', fontSize: 12, marginBottom: 0 }}>Нажмите кнопку подготовки и отойдите от телефона. Когда нужные части тела будут видны 3 секунды подряд, тренировка начнётся автоматически. При потере видимости отсчёт начнётся заново.</p>
    </AdminCard>}
    <div className="flex flex-wrap gap-3">
      {cameraStatus === 'off' && <AdminButton icon={Camera} onClick={() => { clearReadiness(); void startCamera(); }}>Включить камеру</AdminButton>}
      <AdminButton icon={Play} disabled={!canStart || phase === 'running' || phase === 'preparing'} onClick={() => void start()}>
        {phase === 'running' ? 'Тренировка идёт' : phase === 'preparing' ? 'Подготовка…' : phase === 'paused' ? 'Продолжить' : phase === 'finished' ? 'Новая тренировка' : 'Подготовиться и начать'}
      </AdminButton>
      {phase === 'preparing' && <AdminButton tone="secondary" onClick={() => { pause(); clearReadiness(); }}>Отменить подготовку</AdminButton>}
      {phase === 'running' && <AdminButton tone="secondary" icon={Pause} onClick={pause}>Пауза</AdminButton>}
      {(phase === 'running' || phase === 'paused') && <AdminButton tone="secondary" icon={Square} onClick={finish}>Завершить</AdminButton>}
      {cameraStatus !== 'off' && <AdminButton tone="secondary" icon={CameraOff} onClick={() => { pause(); stopCamera(); clearReadiness(); }}>Выключить камеру</AdminButton>}
      {phase !== 'running' && <AdminButton tone="secondary" icon={RotateCcw} onClick={() => {
        pause(); resetScore(); clearReadiness(); changePhase('ready'); setMessage(null); const v = trainerRef.current; if (v) v.currentTime = 0;
      }}>Сбросить тест</AdminButton>}
    </div>
    <AdminCard>
      <SectionTitle>Как повторять движения</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label style={{ fontSize: 13 }}>Стороны тела
          <select aria-label="Стороны тела" value={sideMode} disabled={optionsLocked} onChange={(e) => { setSideMode(e.target.value as 'same' | 'opposite'); resetScore(); clearReadiness(); }} style={{ ...inputStyle, marginTop: 6 }}>
            <option value="opposite">Зеркально, как перед тренером</option>
            <option value="same">Та же сторона тела, что у тренера</option>
          </select>
        </label>
        <label style={{ fontSize: 13 }}>Время на повтор движения: {(delayMs / 1000).toFixed(1)} с
          <input aria-label="Задержка повторения движения" type="range" min={0} max={1500} step={100} value={delayMs} disabled={optionsLocked}
            onChange={(e) => { setDelayMs(Number(e.target.value)); resetScore(); clearReadiness(); }} style={{ width: '100%', marginTop: 16, accentColor: 'var(--color-brand)' }} />
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
