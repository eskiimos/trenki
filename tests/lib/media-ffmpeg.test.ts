import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, openSync, readSync, closeSync } from 'fs';
import os from 'os';
import path from 'path';
import { ffprobe, runFfmpeg } from '../../src/lib/media/ffmpeg';
import { analyzeProbe, buildFfmpegArgs, buildThumbnailArgs, moovBeforeMdat, planProcessing } from '../../src/lib/media/probe';

// Интеграционный: настоящий ffmpeg на сгенерированных клипах. На машине без
// ffmpeg (CI без пакета) — пропускается. В проде ffmpeg ставится в Dockerfile.
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

function head(file: string): Buffer {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

describe.skipIf(!hasFfmpeg)('обработка настоящим ffmpeg', () => {
  let dir: string;

  const gen = (name: string, args: string[]) => {
    const out = path.join(dir, name);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, out]);
    return out;
  };

  // Полный цикл воркера без S3: probe → план → ffmpeg → проверка результата.
  const runPipeline = async (input: string) => {
    const info = analyzeProbe(await ffprobe(input));
    const plan = planProcessing(info);
    const output = `${input}.out.mp4`;
    const progress: number[] = [];
    await runFfmpeg(buildFfmpegArgs(plan, input, output), {
      durationSec: info.durationSec,
      onProgress: (p) => progress.push(p),
    });
    const out = analyzeProbe(await ffprobe(output));
    return { info, plan, out, output, progress };
  };

  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'trenki-media-test-'));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('2.7K .mov без faststart (как у админа) → H.264 1920x1080, faststart, AAC', async () => {
    const input = gen('camera.mov', [
      '-f', 'lavfi', '-i', 'testsrc2=size=2688x1512:rate=30:duration=3',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-c:v', 'libx264', '-b:v', '12M', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    ]);
    expect(moovBeforeMdat(head(input))).toBe(false);
    const { plan, out, output, progress } = await runPipeline(input);
    expect(plan.mode).toBe('transcode');
    expect(out).toMatchObject({ videoCodec: 'h264', width: 1920, height: 1080, audioCodec: 'aac', pixFmt: 'yuv420p' });
    expect(Math.abs(out.mappedDurationSec - 3)).toBeLessThan(0.2);
    expect(moovBeforeMdat(head(output))).toBe(true);
    expect(progress[progress.length - 1]).toBe(100);
  }, 120_000);

  it('вертикальное видео с поворотом 90° → 1080x1920 без апскейла', async () => {
    // -display_rotation (входная опция, ffmpeg ≥7) пишет Display Matrix, как iPhone.
    const input = gen('rotated.mov', [
      '-f', 'lavfi', '-i', 'testsrc2=size=2400x1350:rate=30:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    ]);
    const tagged = path.join(dir, 'rotated-tagged.mov');
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-display_rotation', '90', '-i', input, '-c', 'copy', tagged]);
    const { info, out } = await runPipeline(tagged);
    expect(info.height).toBeGreaterThan(info.width);
    expect(out.width).toBe(1080);
    expect(out.height).toBe(1920);
  }, 120_000);

  it('готовый 720p mp4 с PCM-звуком → remux, звук в AAC, faststart', async () => {
    const input = gen('ready.mov', [
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-b:v', '2M', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-shortest',
    ]);
    const { plan, out, output } = await runPipeline(input);
    expect(plan).toMatchObject({ mode: 'remux', audio: 'aac' });
    expect(out).toMatchObject({ videoCodec: 'h264', width: 1280, height: 720, audioCodec: 'aac' });
    expect(moovBeforeMdat(head(output))).toBe(true);
  }, 120_000);

  it('без звука и обложка-кадр 9:16', async () => {
    const input = gen('silent.mp4', [
      '-f', 'lavfi', '-i', 'testsrc2=size=720x1280:rate=30:duration=2',
      '-c:v', 'libx264', '-b:v', '1M', '-pix_fmt', 'yuv420p',
    ]);
    const { out, output } = await runPipeline(input);
    expect(out.audioCodec).toBeNull();
    const thumb = path.join(dir, 'thumb.jpg');
    await runFfmpeg(buildThumbnailArgs(output, thumb, out.durationSec, 'short'));
    const probe = await ffprobe(thumb);
    expect(probe.streams?.[0]).toMatchObject({ width: 1080, height: 1920 });
  }, 120_000);

  it('лишняя длинная аудиодорожка не ломает сверку длительности', async () => {
    const input = gen('two-audio.mov', [
      '-f', 'lavfi', '-i', 'testsrc2=size=2688x1512:rate=30:duration=3',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
      '-f', 'lavfi', '-i', 'sine=frequency=880:duration=10',
      '-map', '0:v', '-map', '1:a', '-map', '2:a',
      '-c:v', 'libx264', '-b:v', '12M', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    ]);
    const { info, out } = await runPipeline(input);
    expect(info.durationSec).toBeGreaterThan(9);
    expect(Math.abs(out.mappedDurationSec - info.mappedDurationSec)).toBeLessThan(0.2);
  }, 120_000);

  it('не видео → ffprobe/анализ падают', async () => {
    const input = gen('audio.m4a', ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-c:a', 'aac']);
    await expect(ffprobe(input).then(analyzeProbe)).rejects.toThrow(/нет видеодорожки/);
  }, 60_000);
});
