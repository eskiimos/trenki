#!/usr/bin/env node
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, mkdir, mkdtemp, rm, statfs } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform, Writable } from 'node:stream';
import { spawn } from 'node:child_process';
import { MigrationError, downloadSize, migrateWithRetry, parseKinescopeId, parseOptions, selectDownloadAsset, trustedDownloadUrl } from './lib/kinescope-migration.mjs';

// Run on the production server/container: DB and S3 credentials stay in env.
// Default is a read-only inventory. Nothing in Kinescope is changed/deleted.
const require = createRequire(import.meta.url);
const emit = (data) => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...data })}\n`);
const safeError = (error) => error instanceof MigrationError ? error.message
  : `Ошибка ${error?.name ?? 'Error'}${error?.$metadata?.httpStatusCode ? ` (HTTP ${error.$metadata.httpStatusCode})` : ''}${/^[A-Z0-9_]{1,80}$/.test(error?.cause?.code ?? '') ? ` (${error.cause.code})` : ''}`;

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('node scripts/migrate-kinescope.mjs [--dry-run | --apply --journal /persistent/report.jsonl] [--type VIDEO|SHORT|ALL] [--id CARD_ID] [--limit 1..1000]\nDefault: dry-run, one candidate. KINESCOPE_API_KEY, DATABASE_URL and S3_* come from server env.\n');
    return;
  }
  const token = process.env.KINESCOPE_API_KEY;
  if (!token || !process.env.DATABASE_URL) throw new MigrationError('Нужны DATABASE_URL и KINESCOPE_API_KEY в окружении сервера');
  const { PrismaClient } = require('../src/generated/prisma');
  const prisma = new PrismaClient();
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const { signal } = controller;
  let failures = 0;
  try {
    const select = { id: true, title: true, videoUrl: true, isPublished: true };
    const where = options.id ? { id: options.id } : undefined;
    const videos = options.type !== 'SHORT' ? await prisma.video.findMany({ where, select, orderBy: { createdAt: 'asc' } }) : [];
    const shorts = options.type !== 'VIDEO' ? await prisma.short.findMany({ where, select, orderBy: { createdAt: 'asc' } }) : [];
    const records = [...videos.map((v) => ({ ...v, type: 'VIDEO' })), ...shorts.map((v) => ({ ...v, type: 'SHORT' }))];
    const candidates = records.filter((v) => parseKinescopeId(v.videoUrl));
    const selected = candidates.slice(0, options.limit);
    emit({ event: 'inventory', mode: options.apply ? 'apply' : 'dry-run', cards: records.length,
      kinescope: candidates.length, selected: selected.length,
      videos: videos.length, shorts: shorts.length });
    const metadata = async (id) => {
      let response;
      try {
        response = await fetch(`https://api.kinescope.io/v1/videos/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` }, redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        });
      } catch { throw new MigrationError('Не удалось получить метаданные Kinescope (сеть или таймаут)', true); }
      if (!response.ok) throw new MigrationError(`Kinescope API: HTTP ${response.status}`, response.status === 429 || response.status >= 500);
      const data = await response.json();
      return data.data ?? data;
    };
    const catalogModel = (type, client = prisma) => type === 'VIDEO' ? client.video : client.short;
    const pending = (record, client = prisma) => client.mediaJob.findFirst({ where: {
      targetType: record.type, targetId: record.id, status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] },
    }, select: { id: true } });
    const isCurrent = async (record) => {
      const current = await catalogModel(record.type).findUnique({ where: { id: record.id }, select: { videoUrl: true } });
      return current?.videoUrl === record.videoUrl && !(await pending(record));
    };
    let io;
    if (options.apply) {
      const config = Object.fromEntries(['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
        .map((name) => [name, process.env[name]]));
      if (Object.values(config).some((v) => !v)) throw new MigrationError('Не настроены все S3_* переменные сервера');
      const endpoint = new URL(config.S3_ENDPOINT);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new MigrationError('S3_ENDPOINT должен быть HTTPS');
      await probeCommand(['-version'], signal);
      await mkdir(dirname(options.journal), { recursive: true });
      // Detect an unwritable journal before transferring anything.
      await appendFile(options.journal, '', { mode: 0o600 });
      const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({ endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: true,
        credentials: { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY },
        requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
        requestHandler: { connectionTimeout: 10_000, socketTimeout: 60_000 } });
      const bucket = config.S3_BUCKET;
      io = {
        metadata, isCurrent,
        download: (asset) => download(asset, signal),
        probe: async (file) => JSON.parse(await probeCommand(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], signal)),
        objectUrl: (key, type) => type === 'VIDEO' ? `s3://${key}`
          : `${config.S3_ENDPOINT.replace(/\/+$/, '')}/${bucket}/${key}`,
        cleanup: (local) => rm(local.directory, { recursive: true, force: true }),
        journal: async (data) => {
          const line = JSON.stringify({ at: new Date().toISOString(), ...data });
          // fsync before changing the card so original addresses survive a crash.
          const { open } = await import('node:fs/promises');
          const file = await open(options.journal, 'a', 0o600);
          try { await file.writeFile(`${line}\n`); await file.sync(); } finally { await file.close(); }
          emit(data);
        },
        copyAndVerify: async (local, key, type) => {
          const params = { Bucket: bucket, Key: key };
          let existing;
          try { existing = await s3.send(new HeadObjectCommand(params), { abortSignal: signal }); }
          catch (error) { if (error?.$metadata?.httpStatusCode !== 404) throw error; }
          if (existing && (existing.ContentLength !== local.bytes || existing.Metadata?.sha256 !== local.sha256)) {
            throw new MigrationError('В целевом ключе S3 уже лежит другой файл; он не перезаписан');
          }
          if (!existing) {
            const body = createReadStream(local.path);
            try {
              await s3.send(new PutObjectCommand({ ...params, Body: body, ContentLength: local.bytes,
                ContentType: 'video/mp4', Metadata: { sha256: local.sha256 },
                ...(type === 'SHORT' ? { ACL: 'public-read' } : {}) }), { abortSignal: signal });
            } finally { body.destroy(); }
          }
          const result = await s3.send(new GetObjectCommand(params), { abortSignal: signal });
          if (!result.Body || result.ContentLength !== local.bytes) throw new MigrationError('Размер копии S3 не совпадает');
          const hash = createHash('sha256');
          let bytes = 0;
          const watcher = watchStream((chunk) => { bytes += chunk.length; hash.update(chunk); });
          try {
            await pipeline(result.Body, watcher.stream, new Writable({ write(_chunk, _encoding, cb) { cb(); } }), { signal });
          } finally { watcher.close(); result.Body.destroy(); }
          if (bytes !== local.bytes || hash.digest('hex') !== local.sha256) throw new MigrationError('Контрольная сумма копии S3 не совпадает');
        },
        switchSource: (record, newUrl) => prisma.$transaction(async (tx) => {
          // Lock the card, then recheck media jobs and URL. Publication and every
          // other card field remain current; we change only the file address.
          if (record.type === 'VIDEO') await tx.$queryRaw`SELECT id FROM videos WHERE id = ${record.id} FOR UPDATE`;
          else await tx.$queryRaw`SELECT id FROM shorts WHERE id = ${record.id} FOR UPDATE`;
          if (await pending(record, tx)) return false;
          const { count } = await catalogModel(record.type, tx).updateMany({
            where: { id: record.id, videoUrl: record.videoUrl }, data: { videoUrl: newUrl },
          });
          return count === 1;
        }),
      };
    }
    let migrated = 0;
    let skipped = 0;
    for (const record of selected) {
      if (signal.aborted) break;
      try {
        if (!options.apply) {
          if (!(await isCurrent(record))) { skipped++; emit({ event: 'skipped', type: record.type, id: record.id, reason: 'Есть задача обработки или карточка изменена' }); continue; }
          const data = await metadata(parseKinescopeId(record.videoUrl));
          if (data.status !== 'done') throw new MigrationError('Видео в Kinescope ещё не обработано');
          const asset = selectDownloadAsset(data.assets);
          emit({ event: 'candidate', type: record.type, id: record.id, title: record.title, published: record.isPublished,
            quality: asset.quality, bytes: asset.file_size });
        } else {
          emit({ event: 'started', type: record.type, id: record.id, title: record.title });
          const result = await migrateWithRetry(record, io, { signal,
            wait: (attempt) => new Promise((resolve) => setTimeout(resolve, attempt * 2000)),
            onRetry: (attempt, error) => emit({ event: 'retry', type: record.type, id: record.id, attempt, error: safeError(error) }),
          });
          if (result.status === 'migrated') migrated++; else skipped++;
          emit({ event: result.status, type: record.type, id: record.id, ...(result.reason ? { reason: result.reason } : {}) });
        }
      } catch (error) {
        if (signal.aborted) break;
        failures++;
        emit({ event: 'failed', type: record.type, id: record.id, error: safeError(error) });
      }
    }
    emit({ event: 'finished', migrated, skipped, failed: failures, interrupted: signal.aborted });
    if (failures || signal.aborted) process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await prisma.$disconnect();
  }
}

function watchStream(onChunk) {
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => stream.destroy(new MigrationError('Передача файла остановилась на 60 секунд')), 60_000);
  };
  const stream = new Transform({ transform(chunk, _encoding, cb) {
    arm();
    try { onChunk(chunk); cb(null, chunk); } catch (error) { cb(error); }
  }, flush(cb) { clearTimeout(timer); cb(); } });
  arm();
  return { stream, close: () => clearTimeout(timer) };
}

async function download(asset, signal) {
  let lastError;
  for (const url of asset.downloadUrls ?? [asset.url]) {
    try { return await downloadOne({ ...asset, url }, signal); }
    catch (error) { if (signal.aborted) throw error; lastError = error; }
  }
  throw lastError;
}

async function downloadOne(asset, signal) {
  const disk = await statfs(tmpdir());
  if (disk.bavail * disk.bsize < asset.file_size + 250 * 1024 ** 2) throw new MigrationError('Недостаточно свободного места для временного видео');
  const directory = await mkdtemp(join(tmpdir(), 'trenki-kinescope-'));
  const path = join(directory, 'video.mp4');
  let response;
  let watcher;
  try {
    let url = asset.url;
    for (let redirect = 0; redirect <= 4; redirect++) {
      if (!trustedDownloadUrl(url)) throw new MigrationError('Kinescope вернул недопустимый адрес скачивания');
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(40 * 60_000)]) });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location || redirect === 4) throw new MigrationError('Некорректное перенаправление скачивания');
      url = new URL(location, url).href;
    }
    if (!response.ok || !response.body) throw new MigrationError(`Скачивание Kinescope: HTTP ${response.status}`, [403, 429].includes(response.status) || response.status >= 500);
    const sha = createHash('sha256');
    // API asset.file_size describes the video asset; the served MP4 can also
    // contain audio. Actual Content-Length is authoritative for completeness.
    const expectedBytes = downloadSize(response.headers.get('content-length'));
    const currentDisk = await statfs(tmpdir());
    if (currentDisk.bavail * currentDisk.bsize < expectedBytes + 250 * 1024 ** 2) throw new MigrationError('Недостаточно места для готового MP4');
    let bytes = 0;
    watcher = watchStream((chunk) => {
      bytes += chunk.length;
      if (bytes > expectedBytes) throw new MigrationError('Скачанный файл больше заявленного HTTP-размера');
      sha.update(chunk);
    });
    await pipeline(Readable.fromWeb(response.body), watcher.stream, createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal });
    if (bytes !== expectedBytes) throw new MigrationError('Скачанный файл неполный');
    return { directory, path, bytes, sha256: sha.digest('hex') };
  } catch (error) {
    await response?.body?.cancel().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  } finally { watcher?.close(); }
}

function probeCommand(args, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'ignore'], signal });
    let stdout = '';
    const timeout = setTimeout(() => child.kill('SIGKILL'), 120_000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 2 * 1024 * 1024) child.kill('SIGKILL');
    });
    child.once('error', () => { clearTimeout(timeout); reject(new MigrationError('Не удалось запустить ffprobe')); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout); else reject(new MigrationError('ffprobe не смог проверить видео'));
    });
  });
}

main().catch((error) => { emit({ event: 'fatal', error: safeError(error) }); process.exitCode = 1; });
