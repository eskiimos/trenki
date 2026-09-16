import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Transform, type Readable } from 'stream';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@/lib/logger';

// Собственное S3-хранилище видео (reg.ru cloud storage, S3-совместимое).
// Секреты — ТОЛЬКО из env, не в репо:
//   S3_ENDPOINT (https://s3.regru.cloud), S3_REGION (ru-1), S3_BUCKET (trenki),
//   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
// Конвенция хранения в БД: Video.videoUrl = `s3://<key>` (напр. s3://videos/<id>.mp4).
// Такой URL сам по себе НЕ играбелен — перед отдачей клиенту его резолвит
// resolveVideoUrl() в presigned GET, и только в роутах с проверкой доступа
// (paywall/auth), чтобы подписанная ссылка не утекала мимо гейтов.
// forcePathStyle обязателен: reg.ru не поддерживает virtual-hosted style бакеты.

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Конфиг из env. null, если что-то не задано (тогда S3 недоступно — деградируем мягко). */
export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint: endpoint.replace(/\/+$/, ''), region, bucket, accessKeyId, secretAccessKey };
}

const S3_URL_PREFIX = 's3://';

/** Наш внутренний URL вида s3://<key>? (НЕ путать с настоящими AWS s3://bucket/key.) */
export function isS3Url(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(S3_URL_PREFIX);
}

/** Ключ объекта из внутреннего URL: s3://videos/a.mp4 → videos/a.mp4. null, если это не s3://. */
export function s3KeyFromUrl(url: string): string | null {
  if (!isS3Url(url)) return null;
  const key = url.slice(S3_URL_PREFIX.length);
  return key.length > 0 ? key : null;
}

// Клиент кэшируем на модуль: env не меняется в рантайме, а создание клиента не бесплатно.
let cachedClient: S3Client | null = null;

function getClient(config: S3Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // обязательно для reg.ru
      // Сеть к S3 не должна вешать запрос/воркер навсегда (удаление объектов).
      // requestTimeout без throwOnRequestTimeout только пишет WARN — нужен флаг;
      // socketTimeout — простой сокета.
      requestHandler: {
        connectionTimeout: 10_000,
        socketTimeout: 30_000,
        requestTimeout: 30_000,
        throwOnRequestTimeout: true,
      },
    });
  }
  return cachedClient;
}

// Отдельный клиент для серверной перекачки больших файлов (воркер обработки
// видео). С дефолтным requestChecksumCalculation=WHEN_SUPPORTED SDK шлёт
// потоковое тело как aws-chunked с CRC32-трейлером — старые Ceph RGW (reg.ru)
// такое либо не принимают, либо сохраняют Content-Encoding: aws-chunked на
// объекте. WHEN_REQUIRED даёт обычный PUT с Content-Length. Presigned-ссылки
// для браузера остаются на основном клиенте — там всё проверено на проде.
let cachedTransferClient: S3Client | null = null;

function getTransferClient(config: S3Config): S3Client {
  if (!cachedTransferClient) {
    cachedTransferClient = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      // socketTimeout — простой сокета (большой PUT идёт долго, но не молча).
      // Общий requestTimeout не ставим: он оборвал бы заливку дольше лимита.
      // Для тела GetObject таймер снимается после заголовков — у скачивания свой
      // сторож простоя (downloadObjectToFile).
      requestHandler: { connectionTimeout: 10_000, socketTimeout: 120_000 },
    });
  }
  return cachedTransferClient;
}

function requireConfig(): S3Config {
  const config = getS3Config();
  if (!config) throw new Error('S3 не сконфигурирован (нет S3_* переменных окружения)');
  return config;
}

/** Размер объекта в байтах; null — объекта нет. */
export async function headObjectSize(key: string, signal?: AbortSignal): Promise<number | null> {
  const config = requireConfig();
  try {
    const res = await getTransferClient(config).send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
      { abortSignal: signal },
    );
    return typeof res.ContentLength === 'number' ? res.ContentLength : 0;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

const DOWNLOAD_STALL_MS = 60_000;

/** Потоковое скачивание объекта в локальный файл (память не растёт с размером). */
export async function downloadObjectToFile(key: string, filePath: string, signal?: AbortSignal): Promise<void> {
  const config = requireConfig();
  const res = await getTransferClient(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    { abortSignal: signal },
  );
  if (!res.Body) throw new Error(`S3: пустое тело объекта ${key}`);
  // Сторож простоя: соединение, которое перестало отдавать байты, иначе
  // висело бы бесконечно и держало очередь обработки.
  let timer: NodeJS.Timeout | null = null;
  const watchdog = new Transform({
    transform(chunk, _enc, cb) {
      arm();
      cb(null, chunk);
    },
    flush(cb) {
      if (timer) clearTimeout(timer);
      cb();
    },
  });
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => watchdog.destroy(new Error(`скачивание из хранилища зависло (${key})`)), DOWNLOAD_STALL_MS);
  };
  arm();
  try {
    await pipeline(res.Body as Readable, watchdog, createWriteStream(filePath), { signal });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Загрузка локального файла одним PUT (до 5 ГиБ — лимит S3; результаты
 * обработки — сотни МБ). Файл читается потоком, Content-Length берётся из fs.
 */
export async function uploadFileToObject(
  filePath: string,
  key: string,
  contentType: string,
  opts?: { acl?: 'public-read'; signal?: AbortSignal },
): Promise<void> {
  const config = requireConfig();
  const { size } = await stat(filePath);
  const body = createReadStream(filePath);
  try {
    await getTransferClient(config).send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentLength: size,
        ContentType: contentType,
        ...(opts?.acl ? { ACL: opts.acl } : {}),
      }),
      { abortSignal: opts?.signal },
    );
  } finally {
    // При ошибке/отмене SDK не закрывает поток: открытый fd держал бы место
    // удалённого временного файла до конца процесса.
    body.destroy();
  }
}

/** Ключи объектов по префиксу (с пагинацией) — для уборки брошенных исходников. */
export async function listObjects(
  prefix: string,
  opts: { maxKeys?: number; signal?: AbortSignal } = {},
): Promise<Array<{ key: string; lastModified: Date | null }>> {
  const config = requireConfig();
  const maxKeys = opts.maxKeys ?? 5000;
  const result: Array<{ key: string; lastModified: Date | null }> = [];
  let token: string | undefined;
  do {
    const res = await getTransferClient(config).send(
      new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix, ContinuationToken: token }),
      { abortSignal: opts.signal },
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) result.push({ key: obj.Key, lastModified: obj.LastModified ?? null });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token && result.length < maxKeys);
  return result;
}

/** URL указывает на объект нашего бакета (s3://key или публичный https бакета). */
export function isOwnStorageUrl(url: string | null | undefined): boolean {
  return !!url && (s3KeyFromUrl(url) !== null || s3KeyFromPublicUrl(url) !== null);
}

/** Публичный https-URL объекта (path-style reg.ru) — для public-read превью и шортсов. */
export function publicObjectUrl(key: string): string {
  const config = requireConfig();
  return `${config.endpoint}/${config.bucket}/${key}`;
}

/** TTL по умолчанию для просмотра — 6 часов (хватает на любую тренировку с запасом). */
const DEFAULT_GET_TTL_SEC = 21600;
/** TTL по умолчанию для загрузки админом — 1 час. */
const DEFAULT_PUT_TTL_SEC = 3600;

/**
 * Presigned GET на объект — временная прямая ссылка для <video src>.
 * Бросает Error, если S3 не сконфигурирован (вызывающий код проверяет getS3Config()
 * или использует resolveVideoUrl, который деградирует мягко).
 */
export async function presignGetUrl(key: string, expiresSec: number = DEFAULT_GET_TTL_SEC): Promise<string> {
  const config = getS3Config();
  if (!config) throw new Error('S3 не сконфигурирован (нет S3_* переменных окружения)');
  const command = new GetObjectCommand({ Bucket: config.bucket, Key: key });
  return getSignedUrl(getClient(config), command, { expiresIn: expiresSec });
}

/**
 * Presigned PUT для прямой загрузки файла из браузера админа в бакет (мимо
 * нашего сервера). Подписан только host (X-Amz-SignedHeaders=host); ACL и
 * checksum уходят в query подписи, Content-Type в подпись не входит — S3
 * сохраняет тот, что браузер пришлёт заголовком.
 */
export async function presignPutUrl(
  key: string,
  contentType: string,
  expiresSec: number = DEFAULT_PUT_TTL_SEC,
  opts?: { acl?: 'public-read' },
): Promise<string> {
  const config = getS3Config();
  if (!config) throw new Error('S3 не сконфигурирован (нет S3_* переменных окружения)');
  // ACL public-read — для превью (публичные объекты, прямые ссылки без TTL).
  // Загружающий шлёт заголовок x-amz-acl: public-read (как в подписи).
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    ...(opts?.acl ? { ACL: opts.acl } : {}),
  });
  return getSignedUrl(getClient(config), command, { expiresIn: expiresSec });
}

/**
 * Резолв videoUrl перед отдачей клиенту: s3://<key> → presigned GET (6 часов),
 * всё остальное (Kinescope, https, пустые строки) — как есть.
 * ВАЖНО: вызывать ТОЛЬКО в роутах, которые уже проверили доступ
 * (requireAuthUser / gatePaidContent) — иначе подписанная ссылка обойдёт paywall.
 * При отсутствии конфига или ошибке подписи возвращаем сырой s3:// (неиграбельно,
 * но без 500 — деградируем мягко, как и остальные интеграции).
 */
/**
 * Ключ объекта из ПУБЛИЧНОГО https-URL нашего бакета
 * (`<endpoint>/<bucket>/<key>` — path-style reg.ru; так пишутся превью и
 * шортсы). null для чужих URL (Kinescope, Cloudinary) — их не трогаем.
 */
export function s3KeyFromPublicUrl(url: string | null | undefined): string | null {
  const config = getS3Config();
  if (!config || !url) return null;
  const prefix = `${config.endpoint}/${config.bucket}/`;
  if (!url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split('?')[0];
  return key.length > 0 ? decodeURIComponent(key) : null;
}

/**
 * Удаление одного объекта с результатом: true — удалён или его и не было,
 * false — S3 не настроено или запрос упал (вызывающий повторит позже).
 */
export async function deleteS3ObjectStrict(url: string, signal?: AbortSignal): Promise<boolean> {
  const config = getS3Config();
  if (!config) return false;
  const key = s3KeyFromUrl(url) ?? s3KeyFromPublicUrl(url);
  if (!key) return true; // не наш объект — удалять нечего
  try {
    await getTransferClient(config).send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }), {
      abortSignal: signal,
    });
    return true;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (status === 404) return true;
    logger.error('deleteS3ObjectStrict: не удалось удалить объект', error, { key });
    return false;
  }
}

/**
 * Best-effort удаление объектов при удалении/замене контента: без него бакет
 * бесконечно копит мусор (оплачиваемое место), а осиротевшие ПУБЛИЧНЫЕ превью
 * остаются доступны по прямым URL навсегда. Ошибки логируем и глотаем —
 * удаление записи в БД важнее файла.
 * Принимает наши url-формы: s3://<key> и публичный https нашего бакета.
 */
export async function deleteS3ObjectsByUrls(urls: Array<string | null | undefined>): Promise<void> {
  const config = getS3Config();
  if (!config) return; // S3 не сконфигурирован — удалять нечего
  const keys = urls
    .map((u) => (u ? s3KeyFromUrl(u) ?? s3KeyFromPublicUrl(u) : null))
    .filter((k): k is string => !!k);
  await Promise.all(
    keys.map(async (key) => {
      try {
        await getClient(config).send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
        );
      } catch (error) {
        logger.error('deleteS3ObjectsByUrls: не удалось удалить объект', error, { key });
      }
    }),
  );
}

export async function resolveVideoUrl(url: string): Promise<string> {
  const key = s3KeyFromUrl(url);
  if (!key) return url;
  if (!getS3Config()) {
    logger.warn('resolveVideoUrl: S3 не сконфигурирован, отдаём сырой s3:// URL');
    return url;
  }
  try {
    return await presignGetUrl(key);
  } catch (error) {
    logger.error('resolveVideoUrl: не удалось подписать URL', error);
    return url;
  }
}
