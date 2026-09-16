import { spawn } from 'child_process';
import { createProgressState, feedProgress, progressPercent, type FfprobeOutput } from './probe';

// Запуск системных ffmpeg/ffprobe (в проде — пакет Alpine из Dockerfile, локально —
// brew). Без shell: аргументы передаются массивом.

const STDERR_TAIL = 2000;

/**
 * Процесс завершился с ошибкой. exitCode — ffmpeg сам отказался (битый/странный
 * файл, повтор не поможет); signal — процесс убили (OOM, рестарт), повтор уместен.
 */
export class MediaProcessError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly stderrTail: string,
  ) {
    super(message);
    this.name = 'MediaProcessError';
  }
}

let ffmpegAvailable: Promise<boolean> | null = null;

/**
 * Есть ли ffmpeg и ffprobe в PATH. Кэшируется только успех: разовый сбой
 * запуска (EAGAIN/EMFILE под нагрузкой) не должен выключать воркер до рестарта.
 */
export function isFfmpegAvailable(): Promise<boolean> {
  if (!ffmpegAvailable) {
    const check = (bin: string) =>
      new Promise<boolean>((resolve) => {
        try {
          const child = spawn(bin, ['-version'], { stdio: 'ignore' });
          child.on('error', () => resolve(false));
          child.on('close', (code) => resolve(code === 0));
        } catch {
          resolve(false);
        }
      });
    ffmpegAvailable = Promise.all([check('ffmpeg'), check('ffprobe')])
      .then(([a, b]) => a && b, () => false)
      .then((ok) => {
        if (!ok) ffmpegAvailable = null;
        return ok;
      });
  }
  return ffmpegAvailable;
}

const FFPROBE_TIMEOUT_MS = 2 * 60_000;

export async function ffprobe(filePath: string, signal?: AbortSignal): Promise<FfprobeOutput> {
  const { stdout } = await run(
    'ffprobe',
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { signal, timeoutMs: FFPROBE_TIMEOUT_MS },
  );
  try {
    return JSON.parse(stdout) as FfprobeOutput;
  } catch {
    throw new Error('ffprobe вернул не-JSON');
  }
}

export interface RunFfmpegOptions {
  /** Длительность входа — для процента по out_time_us. */
  durationSec?: number;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * ffmpeg с минимальным приоритетом CPU (nice 19): на том же VPS живёт
 * приложение, пользователи не должны замечать перекодирования.
 */
export async function runFfmpeg(args: string[], opts: RunFfmpegOptions = {}): Promise<void> {
  const state = createProgressState();
  let lastPercent = -1;
  await run('nice', ['-n', '19', 'ffmpeg', ...args], {
    signal: opts.signal,
    onStdout: (chunk) => {
      if (!opts.onProgress) return;
      feedProgress(state, chunk);
      const pct = progressPercent(state, opts.durationSec ?? 0);
      if (pct !== lastPercent) {
        lastPercent = pct;
        opts.onProgress(pct);
      }
    },
  });
}

function run(
  bin: string,
  args: string[],
  opts: { signal?: AbortSignal; onStdout?: (chunk: string) => void; timeoutMs?: number } = {},
): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const onAbort = () => child.kill('SIGKILL');
    opts.signal?.addEventListener('abort', onAbort, { once: true });
    let timedOut = false;
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, opts.timeoutMs)
      : null;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (opts.onStdout) opts.onStdout(chunk);
      else stdout += chunk;
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_TAIL);
    });
    child.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, sig) => {
      opts.signal?.removeEventListener('abort', onAbort);
      if (timer) clearTimeout(timer);
      if (timedOut) {
        // Как убийство сигналом: повтор уместен.
        reject(new MediaProcessError(`${bin} не ответил за ${Math.round((opts.timeoutMs ?? 0) / 1000)} с`, null, 'SIGKILL', stderr.trim()));
      } else if (opts.signal?.aborted) {
        reject(new Error('aborted'));
      } else if (code === 0) {
        resolve({ stdout });
      } else {
        const name = bin === 'nice' ? 'ffmpeg' : bin;
        reject(new MediaProcessError(`${name} завершился с кодом ${code ?? sig}`, code, sig, stderr.trim()));
      }
    });
  });
}
