import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { referenceSource } from '@/lib/pose/reference-source';

beforeEach(() => {
  vi.stubEnv('S3_ENDPOINT', 'https://storage.example.test');
  vi.stubEnv('S3_REGION', 'test');
  vi.stubEnv('S3_BUCKET', 'trenki');
  vi.stubEnv('S3_ACCESS_KEY_ID', 'test');
  vi.stubEnv('S3_SECRET_ACCESS_KEY', 'test');
});
afterEach(() => vi.unstubAllEnvs());

describe('источники видео для анализа эталона', () => {
  it('читает готовое видео по внутреннему адресу S3', () => {
    expect(referenceSource('s3://videos/ready.mp4')).toEqual({ kind: 's3', key: 'videos/ready.mp4' });
  });

  it('читает HTTPS-адрес нашего бакета, включая URL-encoding и query', () => {
    expect(referenceSource('https://storage.example.test/trenki/videos/тренер%20видео.mp4?download=1'))
      .toEqual({ kind: 's3', key: 'videos/тренер видео.mp4' });
  });

  it.each([
    's3://uploads/raw.mp4',
    'https://storage.example.test/trenki/uploads/raw.mp4',
    'https://storage.example.test/trenki/%75ploads%2Fraw.mp4',
  ])('не допускает необработанный исходник %s', (url) => {
    expect(referenceSource(url)).toBeNull();
  });

  it.each([
    'https://kinescope.io/video',
    'https://storage.example.test/another-bucket/videos/a.mp4',
    'https://storage.example.test.evil/trenki/videos/a.mp4',
    '//storage.example.test/trenki/videos/a.mp4',
    'https://storage.example.test/trenki/videos/%broken.mp4',
    's3://',
    '',
  ])('не допускает чужой или повреждённый источник %s', (url) => {
    expect(referenceSource(url)).toBeNull();
  });

  it('сохраняет поддержку относительных файлов платформы', () => {
    expect(referenceSource('/video/local.mp4')).toEqual({ kind: 'local', path: '/video/local.mp4' });
  });

  it('не считает HTTPS чужого хранилища своим без конфигурации S3', () => {
    vi.stubEnv('S3_BUCKET', '');
    expect(referenceSource('https://storage.example.test/trenki/videos/a.mp4')).toBeNull();
  });
});
