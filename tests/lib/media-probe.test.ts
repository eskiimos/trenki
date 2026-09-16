import { describe, it, expect } from 'vitest';
import {
  analyzeProbe,
  planProcessing,
  buildFfmpegArgs,
  buildThumbnailArgs,
  createProgressState,
  feedProgress,
  progressPercent,
  moovBeforeMdat,
  isMissingFilterError,
  isResourceError,
  MediaPermanentError,
  type FfprobeOutput,
  type MediaInfo,
} from '../../src/lib/media/probe';

// Реальный исходник модуля (Kinescope original у №72–75): .mov 2688x1512 ~12 Мбит/с.
const iphoneMov: FfprobeOutput = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 2688, height: 1512, avg_frame_rate: '30/1', bit_rate: '12100000' },
    { codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
  ],
  format: { duration: '825.0', bit_rate: '12245000', tags: { major_brand: 'qt  ' } },
};

const goodMp4: FfprobeOutput = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720, avg_frame_rate: '30000/1001', bit_rate: '2500000' },
    { codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
  ],
  format: { duration: '60.5', bit_rate: '2700000' },
};

const base: MediaInfo = {
  durationSec: 60,
  mappedDurationSec: 60,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  pixFmt: 'yuv420p',
  fps: 30,
  videoBitRate: 4_000_000,
  hdr: false,
  audioCodec: 'aac',
};

describe('analyzeProbe', () => {
  it('реальный исходник: размеры, битрейт, аудио', () => {
    const info = analyzeProbe(iphoneMov);
    expect(info).toMatchObject({ width: 2688, height: 1512, videoCodec: 'h264', audioCodec: 'aac', durationSec: 825 });
    expect(info.videoBitRate).toBe(12_100_000);
  });

  it('поворот 90° меняет стороны местами (вертикальное видео с iPhone)', () => {
    const info = analyzeProbe({
      streams: [{
        codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, avg_frame_rate: '30/1',
        side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }],
      }],
      format: { duration: '12' },
    });
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
  });

  it('HDR — по передаточной функции, 10-битный SDR — не HDR', () => {
    const hlg = analyzeProbe({
      streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, pix_fmt: 'yuv420p10le', color_transfer: 'arib-std-b67' }],
      format: { duration: '5' },
    });
    expect(hlg.hdr).toBe(true);
    const sdr10 = analyzeProbe({
      streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080, pix_fmt: 'yuv420p10le', color_transfer: 'bt709' }],
      format: { duration: '5' },
    });
    expect(sdr10.hdr).toBe(false);
  });

  it('битрейт видео без bit_rate потока — из формата минус аудио', () => {
    const info = analyzeProbe({
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720 },
        { codec_type: 'audio', codec_name: 'aac', bit_rate: '128000' },
      ],
      format: { duration: '10', bit_rate: '3128000' },
    });
    expect(info.videoBitRate).toBe(3_000_000);
  });

  it('длительность выбранных дорожек не завышается лишней длинной дорожкой', () => {
    const info = analyzeProbe({
      streams: [
        { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, duration: '10.0' },
        { codec_type: 'audio', codec_name: 'aac', duration: '10.1' },
        { codec_type: 'audio', codec_name: 'aac', duration: '30.0' },
      ],
      format: { duration: '30.0' },
    });
    expect(info.durationSec).toBe(30);
    expect(info.mappedDurationSec).toBeCloseTo(10.1);
  });

  it('без длительностей потоков (webm) — берётся из формата', () => {
    const info = analyzeProbe({
      streams: [{ codec_type: 'video', codec_name: 'vp9', width: 1280, height: 720 }],
      format: { duration: '42.5' },
    });
    expect(info.mappedDurationSec).toBe(42.5);
  });

  it('обложка-картинка не считается видеопотоком', () => {
    expect(() =>
      analyzeProbe({ streams: [{ codec_type: 'video', codec_name: 'mjpeg', width: 600, height: 600 }], format: { duration: '100' } }),
    ).toThrow(MediaPermanentError);
  });

  it('нет видео или длительности — постоянная ошибка', () => {
    expect(() => analyzeProbe({ streams: [{ codec_type: 'audio', codec_name: 'aac' }], format: { duration: '5' } })).toThrow(MediaPermanentError);
    expect(() =>
      analyzeProbe({ streams: [{ codec_type: 'video', codec_name: 'h264', width: 10, height: 10 }], format: { duration: '0' } }),
    ).toThrow(MediaPermanentError);
  });
});

describe('planProcessing', () => {
  it('реальный 2.7K исходник пережимается', () => {
    const plan = planProcessing(analyzeProbe(iphoneMov));
    expect(plan.mode).toBe('transcode');
    expect(plan.audio).toBe('aac');
    expect(plan.reasons.join(' ')).toMatch(/2688x1512/);
  });

  it('готовый к вебу mp4 — только remux, аудио копируется', () => {
    expect(planProcessing(analyzeProbe(goodMp4))).toEqual({ mode: 'remux', audio: 'copy', tonemap: false, reasons: [] });
  });

  it('вертикальное 1080x1920 не пережимается из-за размера', () => {
    expect(planProcessing({ ...base, width: 1080, height: 1920 }).mode).toBe('remux');
  });

  it('PCM из камеры в remux кодируется в AAC, без звука — none', () => {
    expect(planProcessing({ ...base, audioCodec: 'pcm_s16le' }).audio).toBe('aac');
    expect(planProcessing({ ...base, audioCodec: null }).audio).toBe('none');
    expect(planProcessing({ ...base, audioCodec: null, width: 3840, height: 2160 }).audio).toBe('none');
  });

  it('пережимаем: HEVC, 60 fps, высокий/неизвестный битрейт, 10 бит; HDR — с тонмаппингом', () => {
    expect(planProcessing({ ...base, videoCodec: 'hevc' }).mode).toBe('transcode');
    expect(planProcessing({ ...base, fps: 59.94 }).mode).toBe('transcode');
    expect(planProcessing({ ...base, fps: 30.3 }).mode).toBe('remux');
    expect(planProcessing({ ...base, videoBitRate: 12_000_000 }).mode).toBe('transcode');
    expect(planProcessing({ ...base, videoBitRate: 0 }).mode).toBe('transcode');
    expect(planProcessing({ ...base, pixFmt: 'yuv420p10le' }).mode).toBe('transcode');
    const hdr = planProcessing({ ...base, videoCodec: 'hevc', hdr: true });
    expect(hdr).toMatchObject({ mode: 'transcode', tonemap: true });
  });

  it('больше 3 часов — постоянная ошибка', () => {
    expect(() => planProcessing({ ...base, durationSec: 4 * 3600, mappedDurationSec: 4 * 3600 })).toThrow(MediaPermanentError);
  });
});

describe('buildFfmpegArgs', () => {
  it('transcode: libx264, ≤1080 по короткой стороне, faststart, прогресс, выход mp4', () => {
    const args = buildFfmpegArgs({ mode: 'transcode', audio: 'aac', tonemap: false, reasons: [] }, 'in.mov', 'out.mp4');
    const joined = args.join(' ');
    expect(joined).toContain('-c:v libx264');
    expect(joined).toContain("min(1080,ih)");
    expect(joined).toContain('-movflags +faststart');
    expect(joined).toContain('-progress pipe:1');
    expect(joined).toContain('-c:a aac');
    expect(joined).toContain('-map 0:a:0?');
    expect(joined).not.toContain('zscale');
    expect(args[args.length - 1]).toBe('out.mp4');
    expect(args[args.indexOf('-i') + 1]).toBe('in.mov');
  });

  it('тонмаппинг — после уменьшения кадра (меньше памяти и времени)', () => {
    const args = buildFfmpegArgs({ mode: 'transcode', audio: 'none', tonemap: true, reasons: [] }, 'in', 'out');
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf.indexOf('tonemap')).toBeGreaterThan(-1);
    expect(vf.indexOf('scale=w=')).toBeLessThan(vf.indexOf('zscale'));
    expect(args).not.toContain('-c:a');
  });

  it('remux: видео копируется без фильтров', () => {
    const args = buildFfmpegArgs({ mode: 'remux', audio: 'copy', tonemap: false, reasons: [] }, 'in', 'out');
    expect(args.join(' ')).toContain('-c:v copy');
    expect(args.join(' ')).toContain('-c:a copy');
    expect(args).not.toContain('-vf');
  });
});

describe('buildThumbnailArgs', () => {
  it('16:9 для видео, 9:16 для шортсов; кадр ~10% длительности, не дальше 20 с', () => {
    const video = buildThumbnailArgs('in.mp4', 't.jpg', 825, 'video');
    expect(video[video.indexOf('-ss') + 1]).toBe('20.00');
    expect(video.join(' ')).toContain('crop=1280:720');
    const short = buildThumbnailArgs('in.mp4', 't.jpg', 15, 'short');
    expect(short[short.indexOf('-ss') + 1]).toBe('1.50');
    expect(short.join(' ')).toContain('crop=1080:1920');
    const tiny = buildThumbnailArgs('in.mp4', 't.jpg', 0.4, 'short');
    expect(tiny[tiny.indexOf('-ss') + 1]).toBe('0.00');
  });
});

describe('прогресс ffmpeg', () => {
  it('накапливает out_time_us через разрывы чанков, N/A не откатывает', () => {
    const state = createProgressState();
    feedProgress(state, 'frame=10\nout_time_us=5000');
    feedProgress(state, '000\nprogress=continue\n');
    expect(progressPercent(state, 10)).toBe(50);
    feedProgress(state, 'out_time_us=N/A\nprogress=continue\n');
    expect(progressPercent(state, 10)).toBe(50);
  });

  it('до progress=end не больше 99, после — 100', () => {
    const state = createProgressState();
    feedProgress(state, 'out_time_us=12000000\nprogress=continue\n');
    expect(progressPercent(state, 10)).toBe(99);
    feedProgress(state, 'progress=end\n');
    expect(progressPercent(state, 10)).toBe(100);
  });
});

describe('классификация ошибок ffmpeg', () => {
  it('нехватка ресурсов сервера — не «битый файл»', () => {
    expect(isResourceError('av_interleaved_write_frame(): No space left on device')).toBe(true);
    expect(isResourceError('Cannot allocate memory')).toBe(true);
    expect(isResourceError('Invalid data found when processing input')).toBe(false);
  });
  it('нет фильтра тонмаппинга', () => {
    expect(isMissingFilterError("No such filter: 'zscale'")).toBe(true);
    expect(isMissingFilterError('moov atom not found')).toBe(false);
  });
});

describe('moovBeforeMdat', () => {
  const atom = (type: string, size: number) => {
    const b = Buffer.alloc(size);
    b.writeUInt32BE(size, 0);
    b.write(type, 4, 'latin1');
    return b;
  };

  it('faststart: ftyp → moov → mdat', () => {
    expect(moovBeforeMdat(Buffer.concat([atom('ftyp', 20), atom('moov', 40), atom('mdat', 16)]))).toBe(true);
  });

  it('камера: ftyp → wide → mdat (moov в конце)', () => {
    expect(moovBeforeMdat(Buffer.concat([atom('ftyp', 20), atom('wide', 8), atom('mdat', 16)]))).toBe(false);
  });

  it('64-битный размер mdat не ломает разбор', () => {
    const mdat = Buffer.alloc(16);
    mdat.writeUInt32BE(1, 0);
    mdat.write('mdat', 4, 'latin1');
    mdat.writeBigUInt64BE(BigInt(5_000_000_000), 8);
    expect(moovBeforeMdat(Buffer.concat([atom('ftyp', 20), mdat]))).toBe(false);
  });

  it('подстрока moov в данных не обманывает; не-mp4 — null', () => {
    const ftyp = atom('ftyp', 24);
    ftyp.write('moov', 12, 'latin1');
    expect(moovBeforeMdat(Buffer.concat([ftyp, atom('mdat', 16)]))).toBe(false);
    expect(moovBeforeMdat(Buffer.from('\x1aE\xdf\xa3webm-ebml-header', 'latin1'))).toBeNull();
  });
});
