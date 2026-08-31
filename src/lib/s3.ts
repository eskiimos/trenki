import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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
    });
  }
  return cachedClient;
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
 * нашего сервера). Content-Type участвует в подписи — клиент обязан отправить
 * PUT с ТЕМ ЖЕ заголовком Content-Type, иначе S3 ответит 403.
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
  // ACL участвует в подписи: загружающий обязан слать x-amz-acl: public-read.
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
 * Первые байты объекта (для серверных проверок формата, напр. faststart).
 * Бросает при отсутствии конфига/объекта — вызывающий решает, что делать.
 */
export async function readObjectRange(key: string, start: number, end: number): Promise<Buffer> {
  const config = getS3Config();
  if (!config) throw new Error('S3 не сконфигурирован');
  const res = await getClient(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=${start}-${end}` }),
  );
  const body = await res.Body?.transformToByteArray();
  return Buffer.from(body ?? []);
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
        logger.error('deleteS3ObjectsByUrls: не удалось удалить объект', { key, error: String(error) });
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
