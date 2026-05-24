import { describe, expect, it } from 'vitest';
import { decodePoseFrames, encodePoseFrames } from '@/lib/pose-storage';

describe('pose-storage codec', () => {
  it('encode/decode round-trip восстанавливает фрейм-документ', () => {
    const doc = {
      fps: 3,
      frames: [
        [0, 500, 500, 90, 510, 510, 88],
        [333, 502, 501, 89, 512, 509, 87],
        [666, 504, 502, 91, 514, 508, 86],
      ],
    };
    const buf = encodePoseFrames(doc);
    const back = decodePoseFrames(buf);
    expect(back).toEqual(doc);
  });

  it('gzip даёт компактный payload (~10× меньше JSON для типичных кадров)', () => {
    // Генерируем «типичный» кадр на 33 ландмарка × (x,y,v) + время.
    const frames: number[][] = [];
    for (let t = 0; t < 200; t += 1) {
      const f: number[] = [t * 33];
      for (let i = 0; i < 33; i += 1) {
        f.push(500 + i, 500 + i, 90);
      }
      frames.push(f);
    }
    const doc = { fps: 3, frames };
    const json = Buffer.from(JSON.stringify(doc), 'utf8');
    const gz = encodePoseFrames(doc);
    // gzip должен быть существенно меньше — повторяющиеся числа жмутся отлично.
    expect(gz.length).toBeLessThan(json.length / 5);
  });

  it('пустые кадры тоже round-trip-ятся', () => {
    const doc = { fps: null, frames: [] as number[][] };
    expect(decodePoseFrames(encodePoseFrames(doc))).toEqual(doc);
  });

  it('decode игнорирует посторонние поля', () => {
    const payload = encodePoseFrames({
      fps: 5,
      frames: [[1, 2, 3]],
      // @ts-expect-error — лишнее поле должно игнорироваться декодером.
      extra: 'ignored',
    });
    const back = decodePoseFrames(payload);
    expect(Object.keys(back).sort()).toEqual(['fps', 'frames']);
  });
});
