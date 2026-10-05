import { describe, expect, it, vi } from 'vitest';
import { MigrationError, downloadSize, migrateRecord, migrateWithRetry, parseKinescopeId, parseOptions, selectDownloadAsset, targetKey, trustedDownloadUrl, verifyProbe } from '../../scripts/lib/kinescope-migration.mjs';

const record = { type: 'VIDEO', id: 'card123456', videoUrl: 'https://kinescope.io/video123456', isPublished: true };
const asset = (quality = '1080p', overrides = {}) => ({
  id: 'asset123456', quality, filetype: 'mp4', original_name: `${quality}.mp4`, file_size: 100,
  download_link: 'https://s3.kinescope.io/videos/asset.mp4?signature=private', ...overrides,
});
const probe = { streams: [{ codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 },
  { codec_type: 'audio', codec_name: 'aac' }], format: { duration: '60', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' } };
const metadata = { status: 'done', duration: 60, assets: [asset()] };
const ports = () => ({
  isCurrent: vi.fn().mockResolvedValue(true), metadata: vi.fn().mockResolvedValue(metadata),
  download: vi.fn().mockResolvedValue({ path: '/tmp/test.mp4', bytes: 100, sha256: 'sha' }),
  probe: vi.fn().mockResolvedValue(probe), copyAndVerify: vi.fn().mockResolvedValue(undefined),
  objectUrl: vi.fn().mockImplementation((key) => `s3://${key}`), journal: vi.fn().mockResolvedValue(undefined),
  switchSource: vi.fn().mockResolvedValue(true), cleanup: vi.fn().mockResolvedValue(undefined),
});

describe('границы источников Kinescope', () => {
  it.each(['https://kinescope.io/video123456', 'https://kinescope.io/embed/video123456', 'https://kinescope.io/video123456/folder'])('распознаёт адрес видео %s', (url) => {
    expect(parseKinescopeId(url)).toBe('video123456');
  });
  it.each(['https://kinescope.io.evil/video123456', 'http://kinescope.io/video123456', '//kinescope.io/video123456',
    'https://user@kinescope.io/video123456', 'https://kinescope.io:444/video123456', 's3://videos/video123456',
    'https://kinescope.io/embed/', 'https://kinescope.io/%2e%2e'])('отвергает чужой или некорректный адрес %s', (url) => {
    expect(parseKinescopeId(url)).toBeNull();
  });
  it.each(['https://s3.kinescope.io/file.mp4', 'https://msk-13-storage.kinescope.io/file.mp4', 'https://kinescopecdn.net/file.mp4', 'https://eu.kinescopecdn.net/file.mp4'])('разрешает доверенный CDN %s', (url) => {
    expect(trustedDownloadUrl(url)).toBe(true);
  });
  it.each(['http://s3.kinescope.io/file.mp4', 'https://kinescopecdn.net.evil/file.mp4', 'https://127.0.0.1/video.mp4',
    'https://kinescope.io/video123456', 'https://user:pass@s3.kinescope.io/a.mp4'])('отвергает опасный download/redirect %s', (url) => {
    expect(trustedDownloadUrl(url)).toBe(false);
  });
  it('выбирает 1080p вместо 4K-оригинала, для старых видео использует 720p', () => {
    expect(selectDownloadAsset([asset('original', { filetype: 'mov', original_name: 'video.mov', resolution: '3840x2160' }), asset('720p'), asset()]).quality).toBe('1080p');
    expect(selectDownloadAsset([asset('480p'), asset('720p')]).quality).toBe('720p');
  });
  it('не передаёт запрос на чужой asset URL и не скачивает файлы неизвестного/огромного размера', () => {
    expect(() => selectDownloadAsset([asset('1080p', { download_link: 'https://evil.test/a.mp4' })])).toThrow();
    expect(() => selectDownloadAsset([asset('1080p', { file_size: 0 })])).toThrow();
    expect(() => selectDownloadAsset([asset('1080p', { file_size: 6 * 1024 ** 3 })])).toThrow();
  });
  it('привязывает стабильный ключ к карточке, исходному адресу и asset', () => {
    expect(targetKey(record, 'video123456', 'asset123456')).toBe(targetKey(record, 'video123456', 'asset123456'));
    expect(targetKey({ ...record, type: 'SHORT' }, 'video123456', 'asset123456')).toMatch(/^shorts\/migrated\//);
    expect(targetKey({ ...record, id: 'other123456' }, 'video123456', 'asset123456')).not.toBe(targetKey(record, 'video123456', 'asset123456'));
    expect(() => targetKey({ ...record, id: '../bad' }, 'video123456', 'asset123456')).toThrow();
  });
});

describe('проверка видео и запуск миграции', () => {
  it('по умолчанию только смотрит каталог; запись требует журнала', () => {
    expect(parseOptions([])).toMatchObject({ apply: false, limit: 1 });
    expect(() => parseOptions(['--apply'])).toThrow('journal');
    expect(parseOptions(['--apply', '--journal', '/persistent/report.jsonl', '--limit', '1000', '--type', 'short'])).toMatchObject({ apply: true, type: 'SHORT', limit: 1000 });
    for (const args of [['--limit', 'NaN'], ['--limit', '0'], ['--type', 'BAD'], ['--journal'], ['--unknown']]) expect(() => parseOptions(args)).toThrow();
  });
  it('проверяет кодеки, контейнер и длительность перед S3', () => {
    expect(verifyProbe(probe, 60)).toBe(60);
    expect(() => verifyProbe({ ...probe, format: { ...probe.format, duration: '10' } }, 60)).toThrow();
    expect(() => verifyProbe({ ...probe, streams: [{ codec_type: 'video', codec_name: 'hevc', width: 1920, height: 1080 }] }, 60)).toThrow();
    expect(() => verifyProbe({ ...probe, format: { duration: '60', format_name: 'matroska' } }, 60)).toThrow();
    expect(() => verifyProbe({ ...probe, streams: [probe.streams[0]] }, 60, true)).toThrow();
  });
  it('использует длину готового MP4 из HTTP, включая аудио; ограничивает размер скачивания', () => {
    expect(downloadSize('316259965')).toBe(316259965);
    for (const header of [null, '', 'NaN', '-1', '0', String(6 * 1024 ** 3)]) expect(() => downloadSize(header)).toThrow();
  });
  it('записывает журнал проверенной копии перед заменой адреса; сохраняет ту же карточку', async () => {
    const io = ports();
    expect((await migrateRecord(record, io)).status).toBe('migrated');
    expect(io.journal).toHaveBeenNthCalledWith(1, expect.objectContaining({ event: 'copy_verified', id: record.id, oldUrl: record.videoUrl }));
    expect(io.journal.mock.invocationCallOrder[0]).toBeLessThan(io.switchSource.mock.invocationCallOrder[0]);
    expect(io.copyAndVerify.mock.invocationCallOrder[0]).toBeLessThan(io.journal.mock.invocationCallOrder[0]);
    expect(io.switchSource).toHaveBeenCalledWith(record, expect.stringMatching(/^s3:\/\/videos\/migrated\//));
    expect(JSON.stringify(io.journal.mock.calls)).not.toContain('signature=private');
    expect(io.cleanup).toHaveBeenCalledOnce();
  });
  it('при ошибке S3/контрольной суммы не меняет адрес и удаляет временный файл', async () => {
    const io = ports();
    io.copyAndVerify.mockRejectedValue(new Error('checksum mismatch'));
    await expect(migrateRecord(record, io)).rejects.toThrow('checksum');
    expect(io.switchSource).not.toHaveBeenCalled();
    expect(io.cleanup).toHaveBeenCalledOnce();
  });
  it('при сбое журнала не переключает карточку', async () => {
    const io = ports();
    io.journal.mockRejectedValue(new Error('disk full'));
    await expect(migrateRecord(record, io)).rejects.toThrow('disk full');
    expect(io.switchSource).not.toHaveBeenCalled();
  });
  it('не скачивает карточку с активной обработкой/новым источником', async () => {
    const io = ports();
    io.isCurrent.mockResolvedValue(false);
    expect((await migrateRecord(record, io)).status).toBe('skipped');
    expect(io.download).not.toHaveBeenCalled();
  });
  it('не переключает видео, изменённое во время скачивания', async () => {
    const io = ports();
    io.isCurrent.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await migrateRecord(record, io)).status).toBe('skipped');
    expect(io.copyAndVerify).not.toHaveBeenCalled();
    expect(io.switchSource).not.toHaveBeenCalled();
    expect(io.cleanup).toHaveBeenCalledOnce();
  });
  it('конфликт в атомарной замене не считается успешной миграцией', async () => {
    const io = ports();
    io.switchSource.mockResolvedValue(false);
    expect((await migrateRecord(record, io)).status).toBe('skipped');
    expect(io.journal).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'conflict' }));
  });
  it('при сетевой ошибке заново получает подписанные ссылки; постоянные ошибки не повторяет', async () => {
    const io = ports();
    io.download.mockRejectedValueOnce(new TypeError('network')).mockResolvedValue({ path: '/tmp/test.mp4', bytes: 100, sha256: 'sha' });
    const onRetry = vi.fn();
    expect((await migrateWithRetry(record, io, { onRetry })).status).toBe('migrated');
    expect(io.metadata).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
    const bad = ports();
    bad.download.mockRejectedValue(new MigrationError('Недостаточно места'));
    await expect(migrateWithRetry(record, bad)).rejects.toThrow('места');
    expect(bad.download).toHaveBeenCalledOnce();
  });
  it('после исчерпания попыток сохраняет ошибку и не меняет карточку', async () => {
    const io = ports();
    io.download.mockRejectedValue(new TypeError('network'));
    await expect(migrateWithRetry(record, io, { attempts: 3 })).rejects.toThrow();
    expect(io.download).toHaveBeenCalledTimes(3);
    expect(io.switchSource).not.toHaveBeenCalled();
  });
  it('некорректный MP4 не загружает в S3', async () => {
    const io = ports();
    io.probe.mockResolvedValue({ streams: [], format: { duration: '60' } });
    await expect(migrateRecord(record, io)).rejects.toThrow();
    expect(io.copyAndVerify).not.toHaveBeenCalled();
    expect(io.switchSource).not.toHaveBeenCalled();
    expect(io.cleanup).toHaveBeenCalledOnce();
  });
});
