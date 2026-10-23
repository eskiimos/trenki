'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Crosshair, Download, RotateCcw, Square, X } from 'lucide-react';
import { AdminButton, AdminPage, PageHeader, inputStyle } from '@/components/admin/ui';
import { hasPose } from '@/lib/pose/reference';
import { DEFAULT_EQUIPMENT_SETTINGS, EQUIPMENT_TARGETS, rgbToHsv, validateEquipmentSettings, type EquipmentSettings, type EquipmentTargetId } from '@/lib/pose/equipment-tracker';
import { videoPointFromClient } from '@/lib/pose/equipment-calibration';
import { usePoseCamera } from './usePoseCamera';
import { useEquipmentTracking } from './useEquipmentTracking';
import styles from './EquipmentPrototype.module.css';

const LABELS: Record<EquipmentTargetId, string> = { ball: 'Мяч', stickTop: 'Метка рукояти', stickTip: 'Метка конца клюшки' };

function hueHex(hue: number) {
  const c = (n: number) => {
    const k = (n + hue / 60) % 6;
    return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${c(5)}${c(3)}${c(1)}`;
}

export default function EquipmentPrototype() {
  const [settings, setSettings] = useState<EquipmentSettings>(() => structuredClone(DEFAULT_EQUIPMENT_SETTINGS));
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [body, setBody] = useState<{ found: boolean; timestamp: number } | null>(null);
  const [sampleTarget, setSampleTarget] = useState<EquipmentTargetId | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const lastReport = useRef<unknown>(null);
  const lastReportedDetection = useRef<unknown>(null);
  const reportSettings = useRef(settings);
  const onFrame = useCallback((frame: number[], timestamp: number) => setBody({ found: hasPose(frame), timestamp }), []);
  const onUnavailable = useCallback(() => setBody(null), []);
  const camera = usePoseCamera({ onFrame, onUnavailable, facingMode });
  const equipment = useEquipmentTracking({ videoRef: camera.videoRef, active: camera.status === 'ready', settings });
  const active = camera.status === 'ready';
  const mirrored = (camera.actualFacingMode ?? facingMode) === 'user';
  const configError = validateEquipmentSettings(settings);
  const detection = active && !configError ? equipment.detection : null;

  useEffect(() => {
    if (reportSettings.current !== settings) { reportSettings.current = settings; lastReportedDetection.current = detection; return; }
    if (!detection || lastReportedDetection.current === detection) return;
    lastReportedDetection.current = detection;
    const video = camera.videoRef.current;
    lastReport.current = {
      prototype: 'equipment-v1', capturedAt: new Date().toISOString(),
      settings, detection, equipmentFps: equipment.fps,
      camera: { requestedFacingMode: facingMode, actualFacingMode: camera.actualFacingMode, width: video?.videoWidth, height: video?.videoHeight },
      body: { found: !!body?.found && Math.abs(detection.timestampMs - body.timestamp) < 1000, execution: camera.execution, delegate: camera.delegate },
      equipmentExecution: equipment.execution,
      note: '2D coordinates only; this report contains no images, audio or exercise score.',
    };
    setHasReport(true);
  }, [detection, settings, equipment.fps, equipment.execution, camera.videoRef, camera.actualFacingMode, camera.execution, camera.delegate, facingMode, body]);

  const stop = () => { camera.stop(); setSampleTarget(null); setBody(null); };
  const reset = () => { equipment.reset(); setBody(null); lastReport.current = null; setHasReport(false); setMessage(null); };
  const updateHue = (id: EquipmentTargetId, hue: number) => {
    setSettings((previous) => ({ ...previous, targets: { ...previous.targets, [id]: { ...previous.targets[id], hue } } }));
    setMessage(null);
  };
  const sampleColor = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sampleTarget || !active) return;
    const video = camera.videoRef.current;
    const box = video?.getBoundingClientRect();
    if (!video || !box || video.readyState < 2) return;
    const point = videoPointFromClient(event.clientX, event.clientY, box, video.videoWidth, video.videoHeight, mirrored);
    if (!point) { setMessage({ error: true, text: 'Нажмите на сам предмет внутри изображения камеры.' }); return; }
    try {
      // Sample a tiny patch from the original video, not the drawn overlays.
      const sample = document.createElement('canvas'); sample.width = 3; sample.height = 3;
      const context = sample.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('canvas');
      const x = Math.max(0, Math.min(video.videoWidth - 3, Math.round(point.x * video.videoWidth) - 1));
      const y = Math.max(0, Math.min(video.videoHeight - 3, Math.round(point.y * video.videoHeight) - 1));
      context.drawImage(video, x, y, 3, 3, 0, 0, 3, 3);
      const pixels = context.getImageData(0, 0, 3, 3).data;
      const threshold = settings.targets[sampleTarget];
      const colors = Array.from({ length: 9 }, (_, i) => rgbToHsv(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!)).filter((c) => c.saturation >= threshold.minSaturation && c.value >= threshold.minValue);
      if (colors.length < 3) { setMessage({ error: true, text: 'Цвет слишком тёмный или бледный. Поднесите яркий предмет ближе и выберите его центр.' }); return; }
      const color = colors.sort((a, b) => b.saturation - a.saturation)[Math.floor(colors.length / 2)]!;
      updateHue(sampleTarget, color.hue);
      setMessage({ error: false, text: `${LABELS[sampleTarget]}: цвет выбран. Уберите предмет на рабочее расстояние и проверьте обнаружение.` });
      setSampleTarget(null);
    } catch { setMessage({ error: true, text: 'Не удалось выбрать цвет. Попробуйте ещё раз или используйте палитру ниже.' }); }
  };
  const downloadReport = () => {
    if (!lastReport.current) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport.current, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `trenki-equipment-${Date.now()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <AdminPage width="narrow">
    <PageHeader title="Мяч и клюшка" subtitle="Прототип отслеживания с камерой" icon={Crosshair} backHref="/admin/pose" backLabel="К эталонам" />
    <p className={styles.muted}>Возьмите яркий оранжевый мяч. Закрепите голубую метку на верхней части рукояти и розовую — на конце клюшки. Все три цвета должны отличаться от одежды и фона. Цвета можно настроить ниже.</p>
    <p className={styles.muted}>Поставьте телефон так, чтобы тело, мяч и обе метки были в кадре. Для первого теста двигайтесь медленно и используйте крупные метки при хорошем освещении.</p>
    <div className={styles.controls}>
      <label style={{ fontSize: 13, flex: '1 1 180px' }}>Камера
        <select aria-label="Камера прототипа" style={{ ...inputStyle, marginTop: 6 }} value={facingMode} onChange={(e) => { stop(); setFacingMode(e.target.value as 'user' | 'environment'); setMessage(null); }}>
          <option value="environment">Основная камера</option><option value="user">Фронтальная камера</option>
        </select>
      </label>
      {camera.status === 'off' ? <AdminButton type="button" icon={Camera} onClick={() => { reset(); void camera.start(); }}>Включить камеру</AdminButton>
        : <AdminButton type="button" tone="secondary" icon={Square} onClick={stop}>{camera.status === 'loading' ? 'Отменить включение' : 'Выключить камеру'}</AdminButton>}
    </div>
    {camera.error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{camera.error}</p>}
    {equipment.error && equipment.error !== configError && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{equipment.error}</p>}
    <div ref={previewRef} data-testid="equipment-preview" onPointerUp={sampleColor} className={`${styles.preview} ${sampleTarget ? styles.sampling : ''}`}>
      <video ref={camera.videoRef} muted playsInline autoPlay className={styles.layer} style={{ transform: mirrored ? 'scaleX(-1)' : undefined }} />
      <canvas ref={camera.canvasRef} className={styles.layer} aria-hidden="true" style={{ pointerEvents: 'none', transform: mirrored ? 'scaleX(-1)' : undefined }} />
      <canvas ref={equipment.canvasRef} data-testid="equipment-overlay" className={styles.layer} aria-hidden="true" style={{ pointerEvents: 'none', transform: mirrored ? 'scaleX(-1)' : undefined }} />
      {!active && <div className={styles.banner}>{camera.status === 'loading' ? 'Включаю камеру и загружаю распознавание…' : 'Нажмите «Включить камеру», чтобы начать тест.'}</div>}
      {sampleTarget && <div className={styles.banner}>Нажмите на центр предмета: <b>{LABELS[sampleTarget]}</b>. Выбирайте цвет на самом предмете, а не на нарисованном контуре.</div>}
    </div>
    <div className={styles.statuses} data-testid="equipment-statuses">
      <div className={styles.status}><b>Тело</b><span data-testid="body-status">{!active ? 'Камера выключена' : body?.found && performance.now() - body.timestamp < 1000 ? 'Найдено' : 'Не найдено'}</span></div>
      {EQUIPMENT_TARGETS.map((id) => {
        const target = detection?.targets[id];
        return <div key={id} className={styles.status}><b style={{ color: hueHex(settings.targets[id].hue) }}>{LABELS[id]}</b><span data-testid={`equipment-status-${id}`} data-status={target?.status ?? 'off'}>{!active ? 'Камера выключена' : configError ? 'Проверьте цвета' : target?.status === 'observed' ? `Найден${id === 'ball' ? '' : 'а'}` : target?.status === 'ambiguous' ? 'Несколько похожих объектов' : 'Не найден' + (id === 'ball' ? '' : 'а')}</span></div>;
      })}
    </div>
    <p data-testid="stick-status" className={styles.muted}>{detection?.stick ? 'Клюшка: обе метки видны, линия построена.' : 'Для линии клюшки должны быть видны обе метки.'} {active ? `Анализ предметов: ${equipment.fps.toFixed(1)} кадр/с.` : ''}</p>
    {camera.status !== 'off' && camera.actualFacingMode === null && <p className={styles.muted}>Браузер не сообщил, какая камера выбрана. Проверьте изображение перед тестом.</p>}
    {camera.actualFacingMode && camera.actualFacingMode !== facingMode && <p className={styles.muted}>Браузер выбрал {camera.actualFacingMode === 'user' ? 'фронтальную' : 'основную'} камеру вместо запрошенной. Для смены выберите другую камеру и включите её снова.</p>}
    <div className={styles.controls}>
      <AdminButton type="button" size="sm" tone="secondary" icon={RotateCcw} onClick={reset}>Сбросить траектории</AdminButton>
      <AdminButton type="button" size="sm" tone="secondary" icon={Download} disabled={!hasReport} onClick={downloadReport}>Скачать отчёт</AdminButton>
      {sampleTarget && <AdminButton type="button" size="sm" tone="secondary" icon={X} onClick={() => setSampleTarget(null)}>Отменить выбор цвета</AdminButton>}
    </div>
    <details className={styles.settings} open>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Цвета и чувствительность</summary>
      {EQUIPMENT_TARGETS.map((id) => <div key={id} className={styles.target}>
        <label><input type="color" aria-label={`Цвет: ${LABELS[id]}`} value={hueHex(settings.targets[id].hue)} onChange={(e) => {
          const hex = e.target.value;
          const color = rgbToHsv(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
          if (color.saturation < settings.targets[id].minSaturation || color.value < settings.targets[id].minValue) { setMessage({ error: true, text: 'Выберите яркий насыщенный цвет: серые и тёмные предметы этот прототип не отслеживает.' }); return; }
          updateHue(id, color.hue);
        }} />{LABELS[id]}</label>
        <AdminButton type="button" size="sm" tone="secondary" aria-label={`Выбрать на кадре: ${LABELS[id]}`} disabled={!active} onClick={() => { setSampleTarget(id); setMessage(null); previewRef.current?.scrollIntoView({ block: 'center' }); }}>Выбрать на кадре</AdminButton>
      </div>)}
      <label style={{ display: 'block', marginTop: 16, fontSize: 13 }}>Допуск оттенка: ±{settings.targets.ball.tolerance}°
        <input aria-label="Допуск оттенка" className={styles.range} type="range" min={5} max={35} step={1} value={settings.targets.ball.tolerance} onChange={(e) => {
          const tolerance = Number(e.target.value);
          setSettings((previous) => ({ targets: Object.fromEntries(EQUIPMENT_TARGETS.map((id) => [id, { ...previous.targets[id], tolerance }])) as EquipmentSettings['targets'] }));
        }} />
      </label>
      <p className={styles.muted}>Если предмет теряется — сначала выберите его цвет на кадре и проверьте свет. Увеличение допуска захватывает больше похожих оттенков фона.</p>
      <AdminButton type="button" size="sm" tone="secondary" onClick={() => { setSettings(structuredClone(DEFAULT_EQUIPMENT_SETTINGS)); setSampleTarget(null); setMessage(null); }}>Вернуть исходные цвета</AdminButton>
    </details>
    {configError && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{configError}</p>}
    {message && <p role={message.error ? 'alert' : 'status'} style={{ color: message.error ? 'var(--color-danger)' : 'var(--color-brand)', fontSize: 13 }}>{message.text}</p>}
    <p className={styles.muted}>Это проверка распознавания, без оценки техники. Координаты двумерные, в пределах изображения; точную скорость и расстояние в метрах прототип не измеряет. При перекрытии или потере предмета его контур исчезает.</p>
    <p className={styles.muted}>Кадры и звук не записываются и не отправляются на сервер. Отчёт содержит только настройки, координаты и параметры работы камеры.</p>
  </AdminPage>;
}
