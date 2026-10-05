import { createHash } from 'node:crypto';

export class MigrationError extends Error {
  constructor(message, retryable = false) { super(message); this.retryable = retryable; }
}
const ID = /^[a-zA-Z0-9-]{8,64}$/;
const MAX_BYTES = 5 * 1024 ** 3;

/** Only public player addresses belonging to Kinescope, never arbitrary HTTP. */
export function parseKinescopeId(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'kinescope.io' || url.port || url.username || url.password) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[0] === 'embed' ? parts[1] : parts[0];
    return id && ID.test(id) ? id : null;
  } catch { return null; }
}

/** The API provides signed CDN URLs. Credentials go only to api.kinescope.io. */
export function trustedDownloadUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false;
    return url.hostname === 's3.kinescope.io' || /^[-a-z0-9]+-storage\.kinescope\.io$/.test(url.hostname)
      || url.hostname === 'kinescopecdn.net' || url.hostname.endsWith('.kinescopecdn.net');
  } catch { return false; }
}

/** Copy a processed MP4 up to 1080p; the MOV/4K original is not a browser file. */
export function selectDownloadAsset(assets) {
  const candidates = (Array.isArray(assets) ? assets : []).flatMap((asset) => {
    const height = /^(\d+)p$/.exec(asset.quality ?? '')?.[1]
      ?? (asset.quality === 'original' ? /^\d+x(\d+)$/.exec(asset.resolution ?? '')?.[1] : null);
    const size = Number(asset.file_size);
    const mp4 = String(asset.filetype).toLowerCase() === 'mp4' || /\.mp4$/i.test(asset.original_name ?? '');
    const downloadUrls = [...new Set([asset.url, asset.download_link].filter((value) => value && trustedDownloadUrl(value)))];
    const url = downloadUrls[0];
    if (!mp4 || !height || Number(height) > 1080 || Number(height) <= 0 || !url || !ID.test(asset.id ?? '')
      || !Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) return [];
    return [{ ...asset, url, downloadUrls, file_size: size, height: Number(height) }];
  });
  candidates.sort((a, b) => b.height - a.height || (a.quality === 'original' ? 1 : 0) - (b.quality === 'original' ? 1 : 0));
  if (!candidates.length) throw new MigrationError('Нет доступной MP4-копии до 1080p размером до 5 ГиБ');
  return candidates[0];
}

export function targetKey(record, kinescopeId, assetId) {
  if (!['VIDEO', 'SHORT'].includes(record.type) || !ID.test(record.id) || !ID.test(kinescopeId) || !ID.test(assetId)) {
    throw new MigrationError('Некорректный идентификатор карточки или файла');
  }
  const source = createHash('sha256').update(record.videoUrl).digest('hex').slice(0, 16);
  return `${record.type === 'VIDEO' ? 'videos' : 'shorts'}/migrated/${record.id}/${source}/${assetId}.mp4`;
}

export function downloadSize(header) {
  const bytes = Number(header);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES) throw new MigrationError('Нет допустимого Content-Length готового файла (до 5 ГиБ)');
  return bytes;
}

export function verifyProbe(probe, metadataDuration, hasAudio = false) {
  const video = probe.streams?.find((s) => s.codec_type === 'video' && s.codec_name !== 'mjpeg' && s.codec_name !== 'png');
  const audio = probe.streams?.filter((s) => s.codec_type === 'audio') ?? [];
  const duration = Number(probe.format?.duration);
  if (!String(probe.format?.format_name).split(',').includes('mp4') || video?.codec_name !== 'h264'
    || !video.width || !video.height || Math.min(video.width, video.height) > 1080
    || (hasAudio && audio.length === 0) || audio.some((s) => s.codec_name !== 'aac') || !Number.isFinite(duration) || duration <= 0) {
    throw new MigrationError('Файл не является пригодным для браузера MP4 (H.264/AAC до 1080p)');
  }
  if (!Number.isFinite(metadataDuration) || metadataDuration <= 0
    || Math.abs(duration - metadataDuration) > Math.max(2, metadataDuration * 0.02)) {
    throw new MigrationError('Длительность скачанного файла не совпадает с данными Kinescope');
  }
  return duration;
}

/** Ports isolate transfer from orchestration, so failure/concurrency can be tested. */
export async function migrateRecord(record, io) {
  const id = parseKinescopeId(record.videoUrl);
  if (!id) throw new MigrationError('Карточка не содержит ссылку Kinescope');
  if (!(await io.isCurrent(record))) return { status: 'skipped', reason: 'Карточка изменена или уже обрабатывается' };
  const metadata = await io.metadata(id);
  if (metadata.status !== 'done') throw new MigrationError('Видео в Kinescope ещё не обработано');
  const asset = selectDownloadAsset(metadata.assets);
  const key = targetKey(record, id, asset.id);
  let local;
  try {
    local = await io.download(asset);
    verifyProbe(await io.probe(local.path), Number(metadata.duration), metadata.has_audio === true);
    if (!(await io.isCurrent(record))) return { status: 'skipped', reason: 'Карточка изменилась во время скачивания' };
    await io.copyAndVerify(local, key, record.type);
    const newUrl = io.objectUrl(key, record.type);
    // Durable journal precedes DB changes. No API tokens or signed CDN URLs.
    await io.journal({ event: 'copy_verified', type: record.type, id: record.id, oldUrl: record.videoUrl, newUrl,
      key, bytes: local.bytes, sha256: local.sha256, quality: asset.quality });
    const updated = await io.switchSource(record, newUrl);
    await io.journal({ event: updated ? 'switched' : 'conflict', type: record.type, id: record.id,
      oldUrl: record.videoUrl, newUrl });
    return updated ? { status: 'migrated', newUrl } : { status: 'skipped', reason: 'Карточка изменена; адрес не заменён' };
  } finally {
    if (local) await io.cleanup(local);
  }
}

/** @param {{ attempts?: number, wait?: (attempt: number) => Promise<void>, onRetry?: (attempt: number, error: unknown) => void | Promise<void>, signal?: AbortSignal }} options */
export async function migrateWithRetry(record, io, options = {}) {
  const { attempts = 3, wait, onRetry, signal } = options;
  for (let attempt = 1; ; attempt++) {
    try { return await migrateRecord(record, io); }
    catch (error) {
      if (signal?.aborted || attempt >= attempts || (error instanceof MigrationError && !error.retryable)) throw error;
      await onRetry?.(attempt, error);
      await wait?.(attempt);
      signal?.throwIfAborted();
    }
  }
}

export function parseOptions(args) {
  const options = { apply: false, limit: 1, type: 'ALL', id: null, journal: null, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--help') options.help = true;
    else if (['--limit', '--type', '--id', '--journal'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new MigrationError(`Не указано значение ${arg}`);
      if (arg === '--limit') options.limit = Number(value);
      else if (arg === '--type') options.type = value.toUpperCase();
      else if (arg === '--id') options.id = value;
      else options.journal = value;
    } else throw new MigrationError(`Неизвестный параметр ${arg}`);
  }
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 1000) throw new MigrationError('--limit: число от 1 до 1000');
  if (!['ALL', 'VIDEO', 'SHORT'].includes(options.type)) throw new MigrationError('--type: VIDEO, SHORT или ALL');
  if (options.id && !ID.test(options.id)) throw new MigrationError('Некорректный --id');
  if (options.apply && !options.journal) throw new MigrationError('Для --apply нужен --journal с постоянным файлом отчёта');
  return options;
}
