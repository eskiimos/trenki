import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { mkdir, open, rm, statfs } from 'fs/promises';
import { prisma } from '@/lib/prisma';
import type { MediaJob } from '@/generated/prisma';
import { logger } from '@/lib/logger';
import {
  deleteS3ObjectStrict,
  deleteS3ObjectsByUrls,
  downloadObjectToFile,
  getS3Config,
  headObjectSize,
  isOwnStorageUrl,
  listObjects,
  publicObjectUrl,
  s3KeyFromUrl,
  uploadFileToObject,
} from '@/lib/s3';
import { ffprobe, isFfmpegAvailable, MediaProcessError, runFfmpeg } from './ffmpeg';
import {
  analyzeProbe,
  buildFfmpegArgs,
  buildThumbnailArgs,
  isMissingFilterError,
  isResourceError,
  MediaPermanentError,
  moovBeforeMdat,
  planProcessing,
} from './probe';
import { isRawUploadUrl } from './url-plan';

// Фоновый воркер обработки видео. Очередь — таблица media_jobs.
//
// Где живёт: в процессе Next.js (отдельного сервиса нет). Запускается «пинком»
// kickMediaWorker(): после постановки задачи, из админских роутов статусов и
// раз в минуту из host-cron (/api/cron/check-workouts). Одна задача за раз.
//
// Деплой пересоздаёт контейнер и убивает ffmpeg вместе с процессом — задача
// остаётся PROCESSING с устаревшим heartbeatAt, и следующий процесс подхватывает
// её заново (с нуля: временные файлы жили в слое контейнера). Такие перехваты
// считаются отдельно от попыток (interruptions): частые пуши не должны
// «сжигать» попытки. Настоящие ошибки повторяются с паузой, после
// MAX_ATTEMPTS — FAILED с кнопкой «Повторить» в админке.

const HEARTBEAT_MS = 15_000;
const STALE_MS = 3 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_INTERRUPTIONS = 20;
/** Пауза перед повтором после ошибки: attempts=1 → 1 мин, 2 → 5 мин, ≥3 → 15 мин. */
const RETRY_DELAYS_MS = [0, 60_000, 5 * 60_000, 15 * 60_000];
/** Не чаще раза в N мс проверять пустую очередь (cron и поллинг админки дёргают часто). */
const IDLE_RECHECK_MS = 5_000;
/** Запас диска сверх исходника и результата. */
const DISK_MARGIN_BYTES = 500 * 1024 * 1024;
/** Прежний файл удаляем не раньше: presigned-ссылка зрителя живёт до 6 часов. */
const PREVIOUS_FILE_GRACE_MS = 7 * 60 * 60_000;
/** Брошенный исходник (залит, но карточку не сохранили) удаляем через 2 суток. */
const ORPHAN_UPLOAD_AGE_MS = 48 * 60 * 60_000;
const HOUSEKEEPING_INTERVAL_MS = 30 * 60_000;
const ORPHAN_SWEEP_INTERVAL_MS = 6 * 60 * 60_000;

interface WorkerState {
  running: boolean;
  lastIdleCheckAt: number;
  /** Пульс старше старта процесса — от умершего процесса (одновременно контейнер один). */
  processStartedAt: number;
  warnedUnavailable: boolean;
  lastHousekeepingAt: number;
  lastOrphanSweepAt: number;
}

// Модули роутов и cron — разные экземпляры модуля в сборке Next; общий только
// globalThis. Иначе два «воркера» в одном процессе параллельно жгли бы CPU.
const globalForWorker = globalThis as unknown as { __trenkiMediaWorker?: WorkerState };

function getState(): WorkerState {
  if (!globalForWorker.__trenkiMediaWorker) {
    globalForWorker.__trenkiMediaWorker = {
      running: false,
      lastIdleCheckAt: 0,
      processStartedAt: Date.now(),
      warnedUnavailable: false,
      lastHousekeepingAt: 0,
      lastOrphanSweepAt: 0,
    };
  }
  return globalForWorker.__trenkiMediaWorker;
}

/** Запустить воркер, если он не работает. Не ждёт окончания (fire-and-forget). */
export function kickMediaWorker(opts: { immediate?: boolean } = {}): void {
  const state = getState();
  if (state.running) return;
  if (!opts.immediate && Date.now() - state.lastIdleCheckAt < IDLE_RECHECK_MS) return;
  state.running = true;
  void runLoop(state)
    .catch((error) => logger.error('media worker: цикл упал', error))
    .finally(() => {
      state.running = false;
      state.lastIdleCheckAt = Date.now();
    });
}

async function runLoop(state: WorkerState): Promise<void> {
  if (!getS3Config()) return;
  if (!(await isFfmpegAvailable())) {
    if (!state.warnedUnavailable) {
      state.warnedUnavailable = true;
      logger.warn('media worker: ffmpeg/ffprobe не найдены — видео не обрабатываются');
    }
    return;
  }
  state.warnedUnavailable = false;
  for (;;) {
    const job = await claimNextJob(state.processStartedAt);
    if (!job) break;
    await processJob(job);
  }
  await housekeeping(state);
}

async function claimNextJob(processStartedAt: number): Promise<MediaJob | null> {
  for (;;) {
    const now = new Date();
    const staleBefore = new Date(Math.max(processStartedAt, now.getTime() - STALE_MS));
    const candidate = await prisma.mediaJob.findFirst({
      where: {
        OR: [
          // retryAt — пауза после временной ошибки (не сдвигается правками карточки)
          { status: 'QUEUED', OR: [{ retryAt: null }, { retryAt: { lte: now } }] },
          { status: 'PROCESSING', OR: [{ heartbeatAt: null }, { heartbeatAt: { lt: staleBefore } }] },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;

    const reclaim = candidate.status === 'PROCESSING';
    const exhausted = reclaim ? candidate.interruptions >= MAX_INTERRUPTIONS : candidate.attempts >= MAX_ATTEMPTS;
    if (exhausted) {
      await prisma.mediaJob.updateMany({
        where: { id: candidate.id, updatedAt: candidate.updatedAt },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          stage: null,
          error: reclaim
            ? 'Обработка много раз прерывалась (перезапуски сервера) — нажмите «Повторить»'
            : `${(candidate.error || 'Не удалось обработать видео').replace(RETRY_SUFFIX, '')}${MANUAL_SUFFIX}`,
        },
      });
      continue;
    }

    const startedAt = new Date();
    // Атомарный захват: если между чтением и записью задачу тронули — берём следующую.
    const { count } = await prisma.mediaJob.updateMany({
      where: { id: candidate.id, status: candidate.status, updatedAt: candidate.updatedAt },
      data: {
        status: 'PROCESSING',
        ...(reclaim ? { interruptions: { increment: 1 } } : { attempts: { increment: 1 } }),
        heartbeatAt: startedAt,
        startedAt,
        retryAt: null,
        stage: 'download',
        progress: 0,
      },
    });
    if (count !== 1) continue;
    if (reclaim) {
      logger.warn('media worker: подхватываю прерванную задачу', {
        jobId: candidate.id,
        interruptions: candidate.interruptions + 1,
      });
    }
    return prisma.mediaJob.findUnique({ where: { id: candidate.id } });
  }
}

/** Задачу отменили (админ удалил/заменил) — результат не нужен. */
class JobCanceled extends Error {}
/** Цель (видео/шортс) удалена, а задача не отменена. */
class TargetGone extends Error {}
/** Временная проблема сервера/сети — повтор с паузой, текст показывается админу. */
class MediaTransientError extends Error {}
/** Неизвестно, записалась ли подмена (БД недоступна) — ничего не удаляем. */
class ApplyOutcomeUnknown extends Error {}

const RETRY_SUFFIX = ' — повторим автоматически';
const MANUAL_SUFFIX = ' — нажмите «Повторить»';

async function processJob(job: MediaJob): Promise<void> {
  const dir = path.join(os.tmpdir(), 'trenki-media', job.id);
  const controller = new AbortController();
  const signal = controller.signal;
  let stage = job.stage ?? 'download';
  let progress = 0;
  const startedAt = Date.now();
  const log = { jobId: job.id, targetType: job.targetType, targetId: job.targetId };

  // Пульс + проверка отмены (админ удалил видео или загрузил другой файл).
  const heartbeat = setInterval(() => {
    void (async () => {
      try {
        const current = await prisma.mediaJob.findUnique({ where: { id: job.id }, select: { status: true } });
        if (!current || current.status !== 'PROCESSING') {
          controller.abort();
          return;
        }
        // updateMany по статусу: не «оживляем» задачу, которую уже вернули в очередь.
        await prisma.mediaJob.updateMany({
          where: { id: job.id, status: 'PROCESSING' },
          data: { heartbeatAt: new Date(), stage, progress },
        });
      } catch (error) {
        logger.warn('media worker: не удалось обновить пульс', { ...log, err: String(error) });
      }
    })();
  }, HEARTBEAT_MS);

  const setStage = async (next: string, nextProgress = 0) => {
    if (signal.aborted) throw new JobCanceled();
    stage = next;
    progress = nextProgress;
    await prisma.mediaJob.update({ where: { id: job.id }, data: { stage, progress, heartbeatAt: new Date() } });
  };

  let uploadedUrls: string[] = [];
  let resultUrl: string | null = null;
  try {
    // Цель проверяем до того, как качать 1,8 ГБ.
    if (!(await loadTarget(job))) throw new TargetGone();

    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });

    const sourceKey = s3KeyFromUrl(job.sourceUrl);
    if (!sourceKey) throw new MediaPermanentError('Некорректный адрес исходного файла');
    const size = await headObjectSize(sourceKey, signal);
    if (size === null) throw new MediaPermanentError('Исходный файл не найден в хранилище — загрузите видео заново');
    await ensureDiskSpace(dir, size);

    const input = path.join(dir, `source${path.extname(sourceKey) || '.bin'}`);
    await downloadObjectToFile(sourceKey, input, signal);

    await setStage('probe');
    const info = analyzeProbe(await ffprobe(input, signal));
    const plan = planProcessing(info);
    logger.info('media worker: план обработки', {
      ...log,
      mode: plan.mode,
      reasons: plan.reasons,
      sizeMb: Math.round(size / 1024 / 1024),
      durationSec: Math.round(info.mappedDurationSec),
      frame: `${info.width}x${info.height}`,
      videoCodec: info.videoCodec,
      videoKbps: Math.round(info.videoBitRate / 1000),
    });

    await setStage(plan.mode);
    const output = path.join(dir, 'result.mp4');
    const encode = (tonemap: boolean) =>
      runFfmpeg(buildFfmpegArgs({ ...plan, tonemap }, input, output), {
        durationSec: info.mappedDurationSec,
        onProgress: (pct) => {
          progress = pct;
        },
        signal,
      });
    try {
      await encode(plan.tonemap);
    } catch (error) {
      // Тонмаппинг HDR требует zscale (libzimg). Если фильтра в сборке нет —
      // лучше блёклые цвета, чем неиграбельное видео. Иные ошибки — как есть.
      if (!plan.tonemap || !(error instanceof MediaProcessError) || !isMissingFilterError(error.stderrTail)) {
        throw error;
      }
      logger.warn('media worker: тонмаппинг недоступен, пережимаю без него', { ...log, stderr: error.stderrTail });
      await encode(false);
    }

    // Проверка результата: H.264, длительность совпадает, moov в начале файла.
    const out = analyzeProbe(await ffprobe(output, signal));
    const drift = Math.abs(out.mappedDurationSec - info.mappedDurationSec);
    if (out.videoCodec !== 'h264' || drift > Math.max(2, info.mappedDurationSec * 0.02)) {
      throw new MediaPermanentError(
        'Файл обработался некорректно (длительность не совпала) — попробуйте экспортировать видео заново',
      );
    }
    if ((await readHead(output)) !== true) {
      throw new MediaPermanentError('Файл обработался некорректно — попробуйте экспортировать видео заново');
    }

    const target = await loadTarget(job);
    if (!target) throw new TargetGone();

    let thumbnailUrl: string | null = null;
    if (!target.thumbnail) {
      await setStage('thumbnail', 100);
      try {
        const thumb = path.join(dir, 'thumb.jpg');
        await runFfmpeg(
          buildThumbnailArgs(output, thumb, out.mappedDurationSec, job.targetType === 'SHORT' ? 'short' : 'video'),
          { signal },
        );
        const key = `thumbnails/${randomUUID()}.jpg`;
        await uploadFileToObject(thumb, key, 'image/jpeg', { acl: 'public-read', signal });
        thumbnailUrl = publicObjectUrl(key);
        uploadedUrls.push(thumbnailUrl);
      } catch (error) {
        if (signal.aborted) throw error;
        // Обложка — приятный бонус, не повод валить обработку.
        logger.warn('media worker: не удалось сделать обложку', { ...log, err: String(error) });
      }
    }

    await setStage('upload', 100);
    const isShort = job.targetType === 'SHORT';
    const resultKey = `${isShort ? 'shorts' : 'videos'}/${randomUUID()}.mp4`;
    // Шортсы — бесплатный контент с прямыми публичными ссылками (как и раньше);
    // видео-занятия приватные, плеер получает presigned GET через гейтированные роуты.
    await uploadFileToObject(output, resultKey, 'video/mp4', { acl: isShort ? 'public-read' : undefined, signal });
    resultUrl = isShort ? publicObjectUrl(resultKey) : `s3://${resultKey}`;
    uploadedUrls.push(resultUrl);

    const applied = await applyResultWithRetry(job.id, resultUrl, out.mappedDurationSec, thumbnailUrl);
    if (applied.kind === 'canceled') throw new JobCanceled();
    if (applied.kind === 'gone') throw new TargetGone();
    uploadedUrls = [];

    // Исходник больше не нужен; сгенерированная обложка — если админ успел
    // поставить свою. Прежний файл цели удалит housekeeping позже.
    await deleteS3ObjectsByUrls([job.sourceUrl, applied.thumbnailUsed ? null : thumbnailUrl]);

    logger.info('media worker: видео обработано', {
      ...log,
      mode: plan.mode,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      resultMb: Math.round((await fileSize(output)) / 1024 / 1024),
    });
  } catch (error) {
    if (error instanceof ApplyOutcomeUnknown) {
      // БД недоступна: подмена могла записаться. Не удаляем ни исходник, ни
      // результат; задача останется PROCESSING и будет перехвачена по пульсу
      // (а если подмена прошла — она уже DONE и перехвата не будет).
      logger.error('media worker: не удалось узнать, записалась ли подмена', error, log);
    } else if (error instanceof TargetGone) {
      logger.info('media worker: цель удалена, задача отменена', log);
      await prisma.mediaJob.updateMany({
        where: { id: job.id, status: 'PROCESSING' },
        data: { status: 'CANCELED', finishedAt: new Date(), stage: null },
      });
      await deleteS3ObjectsByUrls([...uploadedUrls, job.sourceUrl]);
    } else if (error instanceof JobCanceled || signal.aborted) {
      logger.info('media worker: задача отменена во время обработки', log);
      await deleteS3ObjectsByUrls(uploadedUrls);
    } else {
      const applied = resultUrl ? await checkApplied(job.id, resultUrl) : 'not_applied';
      if (applied === 'applied') {
        // Подмена закоммичена, упало что-то после: результат уже videoUrl цели.
        logger.warn('media worker: ошибка после успешной подмены', { ...log, err: String(error) });
        await deleteS3ObjectsByUrls([job.sourceUrl]);
      } else if (applied === 'unknown') {
        logger.error('media worker: ошибка и БД недоступна — оставляю задачу на перехват', error, log);
      } else {
        await deleteS3ObjectsByUrls(uploadedUrls);
        await failOrRequeue(job, error);
      }
    }
  } finally {
    clearInterval(heartbeat);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function failOrRequeue(job: MediaJob, error: unknown): Promise<void> {
  const stderr = error instanceof MediaProcessError ? error.stderrTail : '';
  const resource = isResourceError(stderr);
  // Постоянная: файл не переварить (не видео; ffmpeg сам отказался — exit code).
  // Убитый сигналом ffmpeg (OOM, таймаут), нехватка места/памяти, сеть и S3 —
  // временные: повтор с паузой.
  const permanent =
    error instanceof MediaPermanentError ||
    (error instanceof MediaProcessError && error.exitCode !== null && !resource);
  const attemptsLeft = job.attempts < MAX_ATTEMPTS;
  const base =
    error instanceof MediaPermanentError || error instanceof MediaTransientError
      ? error.message
      : resource
        ? 'Серверу не хватило места или памяти'
        : error instanceof MediaProcessError && error.exitCode !== null
          ? 'Не удалось обработать файл — возможно, он повреждён или в неподдерживаемом формате'
          : 'Временная ошибка (сеть или хранилище)';
  logger.error('media worker: ошибка обработки', error, {
    jobId: job.id,
    attempt: job.attempts,
    permanent,
    stderr: stderr ? stderr.slice(-500) : undefined,
  });
  const requeue = !permanent && attemptsLeft;
  // Текст — по фактическому исходу: «повторим сами» только если правда повторим.
  const message = permanent ? base : `${base}${requeue ? RETRY_SUFFIX : MANUAL_SUFFIX}`;
  const delay = RETRY_DELAYS_MS[Math.min(job.attempts, RETRY_DELAYS_MS.length - 1)];
  await prisma.mediaJob.updateMany({
    // Только если задачу не отменили, пока мы падали.
    where: { id: job.id, status: 'PROCESSING' },
    data: requeue
      ? { status: 'QUEUED', error: message, heartbeatAt: null, stage: null, progress: 0, retryAt: new Date(Date.now() + delay) }
      : { status: 'FAILED', error: message, finishedAt: new Date(), stage: null },
  });
}

async function loadTarget(
  job: Pick<MediaJob, 'targetType' | 'targetId'>,
): Promise<{ videoUrl: string; thumbnail: string | null } | null> {
  if (job.targetType === 'SHORT') {
    return prisma.short.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, thumbnail: true } });
  }
  return prisma.video.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, thumbnail: true } });
}

type ApplyOutcome = { kind: 'applied'; thumbnailUsed: boolean } | { kind: 'canceled' } | { kind: 'gone' };

/**
 * Подмена файла у цели и отложенная публикация — одной транзакцией с отметкой
 * DONE. Прежний файл цели запоминается для отложенного удаления.
 */
async function applyResult(
  jobId: string,
  resultUrl: string,
  durationSec: number,
  thumbnailUrl: string | null,
): Promise<ApplyOutcome> {
  return prisma.$transaction(
    async (tx) => {
      // Блокировка строки задачи: PUT карточки меняет намерение публикации и
      // отменяет задачи ДО своей записи — под блокировкой мы либо видим эти
      // изменения, либо коммитим раньше (тогда CAS в PUT вернёт 409).
      await tx.$queryRaw`SELECT id FROM media_jobs WHERE id = ${jobId} FOR UPDATE`;
      const job = await tx.mediaJob.findUnique({ where: { id: jobId } });
      if (!job) return { kind: 'canceled' } as const;

      const target =
        job.targetType === 'SHORT'
          ? await tx.short.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, thumbnail: true } })
          : await tx.video.findUnique({ where: { id: job.targetId }, select: { videoUrl: true, thumbnail: true } });

      // Идемпотентность: прошлая попытка закоммитилась, но ответ потерялся.
      if (job.status === 'DONE' && job.resultUrl === resultUrl) {
        return { kind: 'applied', thumbnailUsed: !!thumbnailUrl && target?.thumbnail === thumbnailUrl } as const;
      }
      if (job.status !== 'PROCESSING') return { kind: 'canceled' } as const;
      if (!target) return { kind: 'gone' } as const;

      const thumbnailUsed = !!thumbnailUrl && !target.thumbnail;
      const common = {
        videoUrl: resultUrl,
        isPublished: job.publishOnReady,
        ...(thumbnailUsed ? { thumbnail: thumbnailUrl } : {}),
      };
      if (job.targetType === 'SHORT') {
        await tx.short.update({ where: { id: job.targetId }, data: common });
      } else {
        // Длительность — из самого файла (при замене файла старая была бы неверной).
        await tx.video.update({ where: { id: job.targetId }, data: { ...common, duration: Math.round(durationSec) } });
      }

      // Прежний файл нашего бакета (замена у готового видео) — на отложенное
      // удаление. Исходник этой задачи удаляется сразу, чужой сырой исходник
      // (параллельная замена) не трогаем вовсе.
      const previous = target.videoUrl;
      const previousUrl =
        previous !== resultUrl && previous !== job.sourceUrl && !isRawUploadUrl(previous) && isOwnStorageUrl(previous)
          ? previous
          : null;

      const { count } = await tx.mediaJob.updateMany({
        where: { id: jobId, status: 'PROCESSING' },
        data: { status: 'DONE', resultUrl, previousUrl, progress: 100, stage: null, error: null, finishedAt: new Date() },
      });
      if (count !== 1) throw new JobCanceled(); // откатит подмену
      return { kind: 'applied', thumbnailUsed } as const;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

async function applyResultWithRetry(
  jobId: string,
  resultUrl: string,
  durationSec: number,
  thumbnailUrl: string | null,
): Promise<ApplyOutcome> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await applyResult(jobId, resultUrl, durationSec, thumbnailUrl);
    } catch (error) {
      if (error instanceof JobCanceled) return { kind: 'canceled' };
      // Коммит мог пройти, а ответ — потеряться.
      const state = await checkApplied(jobId, resultUrl);
      if (state === 'applied') {
        // Не знаем точно, встала ли наша обложка, — безопаснее считать, что да
        // (иначе можно удалить уже записанную в карточку картинку).
        return { kind: 'applied', thumbnailUsed: !!thumbnailUrl };
      }
      if (state === 'unknown') throw new ApplyOutcomeUnknown(String(error));
      if (attempt >= 2) throw error;
      logger.warn('media worker: подмена не удалась, повторяю', { jobId, attempt, err: String(error) });
      await sleep([2_000, 5_000][attempt]);
    }
  }
}

/**
 * Записалась ли подмена: applied / not_applied / unknown (БД так и не ответила).
 * Ждём до ~2 минут (меньше STALE_MS, пульс продолжает идти): короткий рестарт
 * БД не должен выбрасывать уже пережатый и залитый результат.
 */
const CHECK_APPLIED_DELAYS_MS = [2_000, 5_000, 10_000, 20_000, 30_000, 45_000];
async function checkApplied(jobId: string, resultUrl: string): Promise<'applied' | 'not_applied' | 'unknown'> {
  for (let attempt = 0; ; attempt++) {
    try {
      const job = await prisma.mediaJob.findUnique({ where: { id: jobId }, select: { status: true, resultUrl: true } });
      return job?.status === 'DONE' && job.resultUrl === resultUrl ? 'applied' : 'not_applied';
    } catch {
      if (attempt >= CHECK_APPLIED_DELAYS_MS.length) return 'unknown';
      await sleep(CHECK_APPLIED_DELAYS_MS[attempt]);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDiskSpace(dir: string, sourceBytes: number): Promise<void> {
  const fsStat = await statfs(dir);
  const free = Number(fsStat.bavail) * Number(fsStat.bsize);
  // Исходник + результат (не больше исходника при пережатии, ≈ он же при remux).
  const needed = sourceBytes * 2 + DISK_MARGIN_BYTES;
  if (free < needed) {
    throw new MediaTransientError(
      `На сервере мало места (свободно ${Math.round(free / 1024 / 1024)} МБ, нужно ${Math.round(needed / 1024 / 1024)} МБ)`,
    );
  }
}

/**
 * Уборка (не чаще раза в 30 мин, в конце цикла воркера):
 * 1) прежние файлы заменённых видео — через 7 ч, если на них никто не ссылается;
 * 2) брошенные исходники в uploads/ (залили, но карточку не сохранили) — через 2 суток.
 */
async function housekeeping(state: WorkerState): Promise<void> {
  const now = Date.now();
  if (now - state.lastHousekeepingAt < HOUSEKEEPING_INTERVAL_MS) return;
  state.lastHousekeepingAt = now;
  try {
    const due = await prisma.mediaJob.findMany({
      where: {
        status: 'DONE',
        previousUrl: { not: null },
        previousDeletedAt: null,
        finishedAt: { lt: new Date(now - PREVIOUS_FILE_GRACE_MS) },
      },
      select: { id: true, previousUrl: true },
      take: 50,
    });
    for (const job of due) {
      const url = job.previousUrl!;
      // Отметку ставим, только если удалять нечего или удаление прошло —
      // иначе повторим на следующем проходе.
      const done = (await isReferenced(url)) || (await deleteS3ObjectStrict(url, AbortSignal.timeout(60_000)));
      if (done) await prisma.mediaJob.update({ where: { id: job.id }, data: { previousDeletedAt: new Date() } });
    }

    if (now - state.lastOrphanSweepAt < ORPHAN_SWEEP_INTERVAL_MS) return;
    state.lastOrphanSweepAt = now;
    const objects = await listObjects('uploads/', { signal: AbortSignal.timeout(2 * 60_000) });
    let deleted = 0;
    for (const obj of objects) {
      if (!obj.lastModified || now - obj.lastModified.getTime() < ORPHAN_UPLOAD_AGE_MS) continue;
      const url = `s3://${obj.key}`;
      const pending = await prisma.mediaJob.findFirst({
        where: { sourceUrl: url, status: { in: ['QUEUED', 'PROCESSING', 'FAILED'] } },
        select: { id: true },
      });
      if (pending || (await isReferenced(url))) continue;
      if (await deleteS3ObjectStrict(url, AbortSignal.timeout(60_000))) deleted++;
    }
    if (deleted > 0) logger.info('media worker: удалены брошенные исходники', { deleted });
  } catch (error) {
    logger.error('media worker: уборка не удалась', error);
  }
}

async function isReferenced(url: string): Promise<boolean> {
  const [video, short] = await Promise.all([
    prisma.video.findFirst({ where: { videoUrl: url }, select: { id: true } }),
    prisma.short.findFirst({ where: { videoUrl: url }, select: { id: true } }),
  ]);
  return !!video || !!short;
}

async function readHead(filePath: string): Promise<boolean | null> {
  const handle = await open(filePath, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return moovBeforeMdat(buf.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

async function fileSize(filePath: string): Promise<number> {
  const handle = await open(filePath, 'r');
  try {
    return (await handle.stat()).size;
  } finally {
    await handle.close();
  }
}
