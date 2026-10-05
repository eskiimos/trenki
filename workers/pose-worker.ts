import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdir, readFile, rm, stat, statfs, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { prisma } from '../src/lib/prisma';
import type { PoseReferenceJob, Prisma } from '../src/generated/prisma';
import { downloadObjectToFile, getS3Config, headObjectSize, putObjectBuffer } from '../src/lib/s3';
import { referenceSource } from '../src/lib/pose/reference-source';
import { detectSegments } from '../src/lib/pose/segments';
import { MAX_REFERENCE_GZIP_BYTES, MAX_REFERENCE_JSON_BYTES, POSE_REFERENCE_FORMAT, summarizeReference, validateReferenceDoc, type PoseReferenceDoc } from '../src/lib/pose/reference';
import { jobCanResume, leaseWhere, POSE_LEASE_MS, POSE_MAX_VIDEO_BYTES, poseRetryDelay, referenceAttemptKey, referenceSnapshotMatches } from '../src/lib/pose/queue-policy';
import { logger } from '../src/lib/logger';

class PermanentFailure extends Error {}
class LeaseLost extends Error {}
const shuttingDown = new AbortController();
const mark = '/tmp/trenki-pose-worker-alive';
let lastProgressAt = Date.now();
const stop = () => shuttingDown.abort();
process.once('SIGTERM', stop);
process.once('SIGINT', stop);

/** CAS ownership is fenced by a new token on every claim, including stale jobs. */
export async function claimPoseJob(): Promise<PoseReferenceJob | null> {
  for (;;) {
    const now = new Date();
    const candidate = await prisma.poseReferenceJob.findFirst({
      where: { OR: [
        { status: 'QUEUED', OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
        { status: 'PROCESSING', OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: new Date(now.getTime() - POSE_LEASE_MS) } }] },
      ] }, orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    if (!jobCanResume(candidate)) {
      await prisma.poseReferenceJob.updateMany({ where: { id: candidate.id, updatedAt: candidate.updatedAt },
        data: { status: 'FAILED', runToken: null, finishedAt: now, stage: null,
          error: 'Не удалось завершить анализ. Нажмите «Повторить».' } });
      continue;
    }
    const reclaim = candidate.status === 'PROCESSING';
    const token = randomUUID();
    const { count } = await prisma.poseReferenceJob.updateMany({
      where: { id: candidate.id, status: candidate.status, updatedAt: candidate.updatedAt },
      data: { status: 'PROCESSING', runToken: token, heartbeatAt: now, startedAt: now, finishedAt: null,
        retryAt: null, stage: 'download', progress: 0, error: null,
        ...(reclaim ? { interruptions: { increment: 1 } } : { attempts: { increment: 1 } }) },
    });
    if (count !== 1) continue;
    return prisma.poseReferenceJob.findUnique({ where: { id: candidate.id, runToken: token } });
  }
}

async function isCurrent(job: PoseReferenceJob): Promise<boolean> {
  const video = await prisma.video.findUnique({ where: { id: job.videoId }, select: {
    videoUrl: true, poseReference: { select: { updatedAt: true } },
  } });
  return video?.videoUrl === job.sourceUrl
    && referenceSnapshotMatches(job.referenceUpdatedAt, video.poseReference?.updatedAt ?? null);
}

/** Upload to a unique key before this transaction; a rejected result cannot corrupt the old object. */
export async function commitPoseResult(job: PoseReferenceJob, framesUrl: string, doc: PoseReferenceDoc) {
  const summary = summarizeReference(doc);
  const segments = detectSegments(doc.frames, doc.durationMs);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM videos WHERE id = ${job.videoId} FOR UPDATE`;
    // Lock the lease as well: cancellation/retry and completion serialize.
    await tx.$queryRaw`SELECT id FROM pose_reference_jobs WHERE id = ${job.id} FOR UPDATE`;
    const owned = await tx.poseReferenceJob.findFirst({ where: leaseWhere(job) });
    if (!owned) return false;
    const video = await tx.video.findUnique({ where: { id: job.videoId }, select: {
      videoUrl: true, poseReference: { select: { updatedAt: true } },
    } });
    if (video?.videoUrl !== job.sourceUrl || !referenceSnapshotMatches(job.referenceUpdatedAt, video.poseReference?.updatedAt ?? null)) {
      await tx.poseReferenceJob.update({ where: { id: job.id }, data: { status: 'CANCELED', runToken: null,
        finishedAt: new Date(), stage: null, error: 'Видео или эталон изменились во время анализа' } });
      return false;
    }
    const data = { framesUrl, framesEncoding: 'json-gzip', formatVersion: POSE_REFERENCE_FORMAT,
      model: doc.model, fps: doc.fps, ...summary, segments: segments as unknown as Prisma.InputJsonValue };
    await tx.poseReference.upsert({ where: { videoId: job.videoId }, create: { videoId: job.videoId, ...data }, update: data });
    await tx.poseReferenceJob.update({ where: { id: job.id }, data: { status: 'DONE', progress: 100, stage: null,
      finishedAt: new Date(), heartbeatAt: new Date(), runToken: null, error: null } });
    return true;
  });
}

export async function processPoseJob(job: PoseReferenceJob): Promise<void> {
  const dir = join(tmpdir(), 'trenki-pose', `${job.id}-${job.runToken}`);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, shuttingDown.signal]);
  let stage = 'download';
  let progress = 0;
  let lastAdvance = Date.now();
  let heartbeatBusy = false;
  let heartbeatAt = Date.now();
  const heartbeat = setInterval(() => {
    if (heartbeatBusy) return;
    heartbeatBusy = true;
    void (async () => {
      try {
        if (Date.now() - lastAdvance > 5 * 60_000) controller.abort(new PermanentFailure('Распознавание перестало отвечать'));
        const current = await isCurrent(job);
        if (!current) {
          await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job), data: { status: 'CANCELED', runToken: null,
            finishedAt: new Date(), error: 'Видео или эталон изменились во время анализа', stage: null } });
          controller.abort(new LeaseLost()); return;
        }
        const { count } = await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job),
          data: { heartbeatAt: new Date(), stage, progress } });
        if (count !== 1) controller.abort(new LeaseLost());
        else { heartbeatAt = Date.now(); lastProgressAt = Date.now(); }
      } catch {
        // A worker that cannot renew its lease must stop before another can claim it.
        if (Date.now() - heartbeatAt > POSE_LEASE_MS / 2) controller.abort(new LeaseLost());
      } finally { heartbeatBusy = false; }
    })();
  }, 10_000);
  const setStage = (value: string, percent: number) => {
    stage = value; progress = percent; lastAdvance = Date.now(); lastProgressAt = Date.now();
  };
  try {
    if (!(await isCurrent(job))) {
      await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job), data: { status: 'CANCELED', runToken: null,
        finishedAt: new Date(), stage: null, error: 'Видео или эталон изменились во время анализа' } });
      throw new LeaseLost();
    }
    const source = referenceSource(job.sourceUrl);
    if (source?.kind !== 's3') throw new PermanentFailure('Нужен готовый файл в S3');
    const size = await headObjectSize(source.key, signal);
    if (!size || size > POSE_MAX_VIDEO_BYTES) throw new PermanentFailure('Файл отсутствует или превышает 5 ГБ');
    await mkdir(dir, { recursive: true });
    const disk = await statfs(dir);
    if (disk.bavail * disk.bsize < size + 500 * 1024 ** 2) throw new Error('Недостаточно места на диске');
    const videoPath = join(dir, 'video.mp4');
    await downloadObjectToFile(source.key, videoPath, signal);
    if ((await stat(videoPath)).size !== size) throw new Error('Видео скачалось не полностью');
    setStage('analyze', 0);
    const output = join(dir, 'reference.json');
    await analyzeVideo(videoPath, output, signal, (percent) => setStage('analyze', percent));
    setStage('save', 99);
    if ((await stat(output)).size > MAX_REFERENCE_JSON_BYTES) throw new PermanentFailure('Эталон превышает допустимый размер');
    const doc: PoseReferenceDoc = JSON.parse(await readFile(output, 'utf8'));
    const invalid = validateReferenceDoc(doc);
    if (invalid) throw new PermanentFailure(invalid);
    if (summarizeReference(doc).detectedRatio === 0) throw new PermanentFailure('Человек не найден ни в одном кадре. Проверьте видео.');
    const gzip = gzipSync(JSON.stringify(doc), { level: 6 });
    if (gzip.length > MAX_REFERENCE_GZIP_BYTES) throw new PermanentFailure('Сжатый эталон превышает допустимый размер');
    signal.throwIfAborted();
    const key = referenceAttemptKey(job.videoId, job.runToken!);
    await putObjectBuffer(key, gzip, 'application/gzip');
    signal.throwIfAborted();
    const applied = await commitPoseResult(job, `s3://${key}`, doc);
    logger.info('pose worker result', { jobId: job.id, videoId: job.videoId, applied, ...summarizeReference(doc) });
    // Unique abandoned objects are retained on uncertain commits; never delete a possibly referenced object.
  } catch (error) {
    if (shuttingDown.signal.aborted) {
      await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job), data: { heartbeatAt: new Date(0) } }).catch(() => {});
      return;
    }
    if (error instanceof LeaseLost || signal.reason instanceof LeaseLost) {
      // Unknown ownership after a DB outage: allow stale reclaim, never cancel the new owner.
      await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job), data: { heartbeatAt: new Date(0) } }).catch(() => {});
      return;
    }
    const terminal = error instanceof PermanentFailure || job.attempts >= 3;
    const message = error instanceof PermanentFailure ? error.message : 'Не удалось завершить анализ. Возможна ошибка сети или нехватка ресурсов.';
    await prisma.poseReferenceJob.updateMany({ where: leaseWhere(job), data: {
      status: terminal ? 'FAILED' : 'QUEUED', stage: null, runToken: null,
      error: message, retryAt: terminal ? null : new Date(Date.now() + poseRetryDelay(job.attempts)),
      finishedAt: terminal ? new Date() : null,
    } }).catch(() => {});
    logger.warn('pose worker failed', { jobId: job.id, videoId: job.videoId, stage, terminal, errorName: (error as Error)?.name });
  } finally {
    clearInterval(heartbeat);
    await rm(dir, { recursive: true, force: true });
  }
}

export function analyzeVideo(input: string, output: string, signal: AbortSignal, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.POSE_PYTHON ?? '/opt/pose/bin/python', ['workers/pose_analyze.py',
      '--input', input, '--output', output, '--model', process.env.POSE_MODEL_PATH ?? '/opt/pose/models/pose_landmarker_heavy.task'],
    { signal, stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = createInterface({ input: child.stdout });
    let permanent: string | null = null;
    lines.on('line', (line) => {
      try {
        const event = JSON.parse(line);
        if (event.event === 'progress' && Number.isFinite(event.percent)) onProgress(Math.max(0, Math.min(99, Math.round(event.percent))));
        if (event.event === 'invalid') permanent = typeof event.error === 'string' ? event.error.slice(0, 300) : 'Видео нельзя обработать';
      } catch { /* MediaPipe diagnostics are not job protocol messages. */ }
    });
    // Drain native library diagnostics; do not log paths or credentials.
    child.stderr.resume();
    child.on('error', reject);
    child.on('close', (code) => {
      lines.close();
      if (permanent) reject(new PermanentFailure(permanent));
      else if (code === 0) resolve();
      else reject(new Error(`Распознавание завершилось с кодом ${code}`));
    });
  });
}

async function main() {
  if (!getS3Config()) throw new Error('S3 не настроен');
  await mkdir(join(tmpdir(), 'trenki-pose'), { recursive: true });
  // Temp files from a killed container are not needed; each attempt has its own directory.
  let pulseBusy = false;
  const pulseOnce = async () => {
    if (pulseBusy || Date.now() - lastProgressAt >= POSE_LEASE_MS) return;
    pulseBusy = true;
    try {
      const heartbeatAt = new Date();
      await prisma.poseWorkerState.upsert({ where: { id: 'default' }, create: { id: 'default', heartbeatAt }, update: { heartbeatAt } });
      await writeFile(mark, String(Date.now()));
    } catch { /* DB outage is visible in both the API and container health. */ }
    finally { pulseBusy = false; }
  };
  await pulseOnce();
  const pulse = setInterval(() => void pulseOnce(), 10_000);
  try {
    while (!shuttingDown.signal.aborted) {
      try {
        const job = await claimPoseJob();
        if (job) await processPoseJob(job);
        else {
          lastProgressAt = Date.now();
          await new Promise((resolve) => { const t = setTimeout(resolve, 5000); shuttingDown.signal.addEventListener('abort', () => { clearTimeout(t); resolve(undefined); }, { once: true, signal: AbortSignal.timeout(6000) }); });
        }
      } catch (error) {
        logger.warn('pose worker loop error', { errorName: (error as Error)?.name });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } finally { clearInterval(pulse); await prisma.$disconnect(); }
}

if (process.env.POSE_WORKER_TEST !== '1') void main().catch((error) => {
  logger.error('pose worker stopped', { errorName: (error as Error)?.name }); process.exitCode = 1;
});
