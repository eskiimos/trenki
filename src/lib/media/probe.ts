// Чистая логика обработки видео (без ffmpeg, S3 и БД — покрыта unit-тестами).
//
// Контекст: админ заливает в S3 сырой исходник (реально — .mov 2688x1512,
// ~12 Мбит/с, 1,3–1,8 ГБ с iPhone). Раньше такие файлы пережимал Kinescope;
// теперь это делает наш воркер (src/lib/media/worker.ts): H.264 ≤1080p ~4 Мбит/с,
// AAC, faststart. Готовый к вебу mp4 не пережимается — только remux.

/** Минимально нужный кусок вывода `ffprobe -print_format json -show_format -show_streams`. */
export interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  pix_fmt?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  bit_rate?: string;
  duration?: string;
  color_transfer?: string;
  side_data_list?: Array<{ side_data_type?: string; rotation?: number }>;
  tags?: Record<string, string>;
}

export interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    bit_rate?: string;
    size?: string;
    tags?: Record<string, string>;
  };
}

export interface MediaInfo {
  durationSec: number;
  /**
   * Длительность дорожек, которые попадут в результат (первое видео и первое
   * аудио). У исходников бывают дорожки длиннее (второй звук, таймкод) —
   * format.duration по ним завышен, и сверка с результатом ложно падала бы.
   */
  mappedDurationSec: number;
  /** Размеры кадра ПОСЛЕ поворота (как его увидит зритель). */
  width: number;
  height: number;
  videoCodec: string;
  pixFmt: string;
  fps: number;
  /** Битрейт видео, бит/с (оценка: поток, иначе формат). 0 — неизвестен. */
  videoBitRate: number;
  hdr: boolean;
  audioCodec: string | null;
}

export class MediaPermanentError extends Error {
  // «Постоянная» ошибка: повтор не поможет (не видео, пустой файл). Воркер
  // сразу помечает задачу FAILED, а не ставит в очередь заново.
  constructor(message: string) {
    super(message);
    this.name = 'MediaPermanentError';
  }
}

function parseRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split('/').map(Number);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (den === undefined) return num;
  return Number.isFinite(den) && den > 0 ? num / den : 0;
}

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const HDR_TRANSFERS = new Set(['arib-std-b67', 'smpte2084']);

export function analyzeProbe(probe: FfprobeOutput): MediaInfo {
  const streams = probe.streams ?? [];
  // Обложка-картинка в mov/mp4 тоже приходит как video-поток (attached_pic,
  // mjpeg/png) — берём первый «настоящий» видеопоток.
  const video = streams.find(
    (s) => s.codec_type === 'video' && s.codec_name !== 'mjpeg' && s.codec_name !== 'png',
  );
  if (!video || !video.width || !video.height) {
    throw new MediaPermanentError('В файле нет видеодорожки — загрузите видеофайл');
  }
  const audio = streams.find((s) => s.codec_type === 'audio');

  const durationSec = toNumber(probe.format?.duration) || toNumber(video.duration);
  const mappedDurationSec = Math.max(toNumber(video.duration), toNumber(audio?.duration)) || durationSec;
  if (durationSec < 1) {
    throw new MediaPermanentError('Не удалось определить длительность видео — файл повреждён или пустой');
  }

  const rotation = video.side_data_list?.find((d) => d.side_data_type === 'Display Matrix')?.rotation ?? 0;
  const rotated = Math.abs(rotation) % 180 === 90;

  const audioBitRate = toNumber(audio?.bit_rate);
  const formatBitRate = toNumber(probe.format?.bit_rate);
  const videoBitRate =
    toNumber(video.bit_rate) || (formatBitRate ? Math.max(0, formatBitRate - audioBitRate) : 0);

  return {
    durationSec,
    mappedDurationSec,
    width: rotated ? video.height : video.width,
    height: rotated ? video.width : video.height,
    videoCodec: video.codec_name ?? 'unknown',
    pixFmt: video.pix_fmt ?? 'unknown',
    fps: parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate),
    videoBitRate,
    // HDR — только по передаточной функции (HLG/PQ). 10-битный SDR тонмаппинг
    // испортил бы; его пережмёт в 8 бит обычный format=yuv420p (pix_fmt ≠ yuv420p).
    hdr: HDR_TRANSFERS.has(video.color_transfer ?? ''),
    audioCodec: audio?.codec_name ?? null,
  };
}

/** Короткая сторона кадра, до которой ужимаем (1080p и для горизонтальных, и для вертикальных). */
export const TARGET_SHORT_SIDE = 1080;
/** Выше этого видеобитрейта готовый H.264 всё равно пережимаем: на мобильном интернете он «грузится». */
export const MAX_PASSTHROUGH_VIDEO_BPS = 6_000_000;
/** Потолок кадровой частоты результата (60 fps для тренировок не нужны и вдвое дороже в трафике). */
export const MAX_FPS = 30;
/** Защита от случайной заливки многочасовой записи. */
export const MAX_DURATION_SEC = 3 * 60 * 60;

export interface ProcessingPlan {
  mode: 'remux' | 'transcode';
  audio: 'copy' | 'aac' | 'none';
  tonemap: boolean;
  /** Почему пережимаем (для логов). Пусто у remux. */
  reasons: string[];
}

export function planProcessing(info: MediaInfo): ProcessingPlan {
  if (info.mappedDurationSec > MAX_DURATION_SEC) {
    throw new MediaPermanentError('Видео длиннее 3 часов — проверьте, тот ли файл загружен');
  }
  const reasons: string[] = [];
  if (info.videoCodec !== 'h264') reasons.push(`кодек ${info.videoCodec}`);
  if (info.pixFmt !== 'yuv420p' && info.pixFmt !== 'yuvj420p') reasons.push(`pix_fmt ${info.pixFmt}`);
  if (Math.min(info.width, info.height) > TARGET_SHORT_SIDE) reasons.push(`${info.width}x${info.height}`);
  // 29.97/30.00 и дробные значения — не повод пережимать
  if (info.fps > MAX_FPS + 1) reasons.push(`${Math.round(info.fps)} fps`);
  if (info.hdr) reasons.push('HDR');
  // Неизвестный битрейт = не доверяем, пережимаем
  if (!info.videoBitRate || info.videoBitRate > MAX_PASSTHROUGH_VIDEO_BPS) {
    reasons.push(`битрейт ${Math.round(info.videoBitRate / 1000)} кбит/с`);
  }

  const audio: ProcessingPlan['audio'] = !info.audioCodec ? 'none' : info.audioCodec === 'aac' ? 'copy' : 'aac';

  if (reasons.length === 0) {
    // Remux: тот же видеопоток в чистый mp4 с faststart (moov в начале).
    // Аудио не-AAC (PCM из камеры, opus) браузеры в mp4 не играют — кодируем.
    return { mode: 'remux', audio, tonemap: false, reasons };
  }
  return { mode: 'transcode', audio: audio === 'none' ? 'none' : 'aac', tonemap: info.hdr, reasons };
}

// HLG/PQ → SDR bt709. Без тонмаппинга HDR с iPhone выходит блёклым/пересвеченным.
const TONEMAP_FILTER =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';

/**
 * Аргументы ffmpeg (без самого бинаря). Выход — локальный файл: faststart
 * переписывает его на месте, в поток/S3 напрямую писать нельзя.
 */
export function buildFfmpegArgs(plan: ProcessingPlan, input: string, output: string): string[] {
  const args = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error', '-nostats'];
  args.push('-i', input);
  // Только основное видео и первое аудио: у iPhone в .mov ещё таймкод и
  // метаданные-дорожки, в mp4 они не нужны. Метаданные (геометка, дата) срезаем.
  args.push('-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-map_chapters', '-1', '-dn', '-sn');

  if (plan.mode === 'remux') {
    args.push('-c:v', 'copy');
  } else {
    // Поворот применяется автоматически (autorotate) ДО фильтров, поэтому
    // scale видит уже «правильный» кадр: горизонтальный → высота ≤1080,
    // вертикальный → ширина ≤1080. Меньшие кадры не апскейлим.
    const scale =
      "scale=w='if(gte(iw,ih),-2,min(1080,iw))':h='if(gte(iw,ih),min(1080,ih),-2)'";
    // Сначала уменьшаем, потом тонмаппинг: zscale в float на 2.7K-кадре съедал
    // ~120 МБ RAM лишних и вдвое больше времени (при том же цвете).
    const filters = [scale, ...(plan.tonemap ? [TONEMAP_FILTER] : []), 'format=yuv420p'];
    args.push('-vf', filters.join(','));
    args.push('-fpsmax', String(MAX_FPS));
    args.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high',
      '-crf', '23', '-maxrate', '4500k', '-bufsize', '9000k',
      // 2 vCPU на всё приложение: не даём ffmpeg забрать больше.
      '-threads', '2', '-filter_threads', '1',
    );
  }

  if (plan.audio === 'copy') args.push('-c:a', 'copy');
  else if (plan.audio === 'aac') args.push('-c:a', 'aac', '-b:a', '128k', '-ac', '2');

  args.push('-movflags', '+faststart', '-progress', 'pipe:1', '-f', 'mp4', output);
  return args;
}

export type ThumbnailKind = 'video' | 'short';

/** Кадр-обложка: 16:9 1280x720 для видео, 9:16 1080x1920 для шортсов (как у Cloudinary-обложек). */
export function buildThumbnailArgs(
  input: string,
  output: string,
  durationSec: number,
  kind: ThumbnailKind,
): string[] {
  // Первые секунды часто — чёрный кадр/заставка; берём ~10% длительности, но не дальше 20 с.
  const at = Math.min(Math.max(durationSec * 0.1, 0), 20, Math.max(durationSec - 0.5, 0));
  const [w, h] = kind === 'short' ? [1080, 1920] : [1280, 720];
  return [
    '-hide_banner', '-nostdin', '-y', '-loglevel', 'error',
    '-ss', at.toFixed(2), '-i', input,
    '-frames:v', '1',
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
    '-q:v', '3',
    output,
  ];
}

/** stderr ffmpeg говорит о нехватке ресурсов сервера, а не о плохом файле. */
export function isResourceError(stderr: string): boolean {
  return /No space left on device|Cannot allocate memory|Resource temporarily unavailable/i.test(stderr);
}

/** Фильтр тонмаппинга недоступен в этой сборке ffmpeg (нет libzimg). */
export function isMissingFilterError(stderr: string): boolean {
  return /No such filter|zscale/i.test(stderr);
}

/**
 * Накопительный разбор `-progress pipe:1`: блоки key=value, конец блока —
 * progress=continue|end. out_time_us бывает N/A посреди работы — держим
 * последнее известное значение, иначе процент прыгает назад.
 */
export interface ProgressState {
  buffer: string;
  lastOutTimeUs: number;
  ended: boolean;
}

export function createProgressState(): ProgressState {
  return { buffer: '', lastOutTimeUs: 0, ended: false };
}

export function feedProgress(state: ProgressState, chunk: string): void {
  state.buffer += chunk;
  const lines = state.buffer.split('\n');
  state.buffer = lines.pop() ?? '';
  for (const raw of lines) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    if (key === 'out_time_us' || key === 'out_time_ms') {
      const us = Number(value);
      if (Number.isFinite(us) && us > state.lastOutTimeUs) state.lastOutTimeUs = us;
    } else if (key === 'progress' && value === 'end') {
      state.ended = true;
    }
  }
}

/** Процент 0–100; до progress=end не больше 99. */
export function progressPercent(state: ProgressState, durationSec: number): number {
  if (state.ended) return 100;
  if (!durationSec) return 0;
  const pct = Math.floor((state.lastOutTimeUs / 1e6 / durationSec) * 100);
  return Math.max(0, Math.min(99, pct));
}

/**
 * faststart-проверка по атомам верхнего уровня (а не поиском подстроки
 * 'moov', которая случайно встречается в данных). Нужны первые байты файла:
 * у не-faststart файла сразу за ftyp/wide идёт заголовок mdat.
 * true — moov раньше mdat; false — mdat раньше; null — не mp4/не хватило байт.
 */
export function moovBeforeMdat(head: Buffer): boolean | null {
  let offset = 0;
  let sawFtyp = false;
  while (offset + 8 <= head.length) {
    let size = head.readUInt32BE(offset);
    const type = head.toString('latin1', offset + 4, offset + 8);
    if (offset === 0 && type !== 'ftyp') return null;
    if (type === 'ftyp') sawFtyp = true;
    if (type === 'moov') return sawFtyp ? true : null;
    if (type === 'mdat') return sawFtyp ? false : null;
    if (size === 1) {
      if (offset + 16 > head.length) return null;
      const big = head.readBigUInt64BE(offset + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
    } else if (size === 0) {
      return null; // атом «до конца файла» — дальше не пройти
    }
    if (size < 8) return null;
    offset += size;
  }
  return null;
}
