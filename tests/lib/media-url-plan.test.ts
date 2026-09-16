import { describe, it, expect } from 'vitest';
import { isRawUploadUrl, planUrlUpdate, type UrlUpdateInput } from '../../src/lib/media/url-plan';

const RAW_A = 's3://uploads/aaa.mov';
const RAW_B = 's3://uploads/bbb.mov';
const READY = 's3://videos/ready.mp4';
const READY_NEW = 's3://videos/new.mp4';
const SHORT_PUBLIC = 'https://s3.regru.cloud/trenki/shorts/x.mp4';
const KINESCOPE = 'https://kinescope.io/abc';
const KINESCOPE_2 = 'https://kinescope.io/def';

const ownStorage = (url: string) => url.startsWith('s3://') || url.includes('s3.regru.cloud');
const plan = (input: Omit<UrlUpdateInput, 'currentInOwnStorage'>) =>
  planUrlUpdate({ ...input, currentInOwnStorage: ownStorage(input.current) });

describe('isRawUploadUrl', () => {
  it('только s3://uploads/<key>', () => {
    expect(isRawUploadUrl(RAW_A)).toBe(true);
    expect(isRawUploadUrl('s3://uploads/')).toBe(false);
    expect(isRawUploadUrl(READY)).toBe(false);
    expect(isRawUploadUrl(KINESCOPE)).toBe(false);
    expect(isRawUploadUrl(undefined)).toBe(false);
  });
});

describe('planUrlUpdate', () => {
  it('новое видео ещё обрабатывается, админ сохраняет с публикацией → остаётся черновиком, намерение запоминается', () => {
    expect(plan({ current: RAW_A, incoming: RAW_A, requestedPublish: true, incomingHasJob: true })).toEqual({
      videoUrl: RAW_A,
      isPublished: false,
      enqueueSource: null,
      cancelJobs: false,
      updatePublishIntent: true,
      ignoredIncoming: false,
    });
  });

  it('замена файла у готового видео: старый файл остаётся живым до конца обработки', () => {
    expect(plan({ current: READY, incoming: RAW_A, requestedPublish: true, incomingHasJob: false })).toMatchObject({
      videoUrl: READY,
      isPublished: true,
      enqueueSource: RAW_A,
    });
  });

  it('замена ссылки Kinescope файлом — так же, ссылка играет до конца обработки', () => {
    expect(plan({ current: KINESCOPE, incoming: RAW_A, requestedPublish: true, incomingHasJob: false })).toMatchObject({
      videoUrl: KINESCOPE,
      isPublished: true,
      enqueueSource: RAW_A,
    });
  });

  it('другой файл для ещё не готового видео: пишем новый исходник, черновик, новая задача', () => {
    expect(plan({ current: RAW_A, incoming: RAW_B, requestedPublish: true, incomingHasJob: false })).toMatchObject({
      videoUrl: RAW_B,
      isPublished: false,
      enqueueSource: RAW_B,
    });
  });

  describe('устаревшая форма (открыта до окончания обработки)', () => {
    it('прислала уже обработанный исходник → videoUrl не меняется', () => {
      expect(plan({ current: READY_NEW, incoming: RAW_A, requestedPublish: true, incomingHasJob: true })).toMatchObject({
        videoUrl: READY_NEW,
        isPublished: true,
        enqueueSource: null,
        cancelJobs: false,
      });
    });

    it('прислала прежний готовый файл, который воркер подменил → новый результат не теряется', () => {
      expect(plan({ current: READY_NEW, incoming: READY, requestedPublish: true, incomingHasJob: false })).toMatchObject({
        videoUrl: READY_NEW,
        enqueueSource: null,
        cancelJobs: false,
      });
    });

    it('прислала старую ссылку Kinescope после переноса в хранилище → перенос не откатывается', () => {
      expect(plan({ current: READY_NEW, incoming: KINESCOPE, requestedPublish: true, incomingHasJob: false })).toMatchObject({
        videoUrl: READY_NEW,
        cancelJobs: false,
        ignoredIncoming: true, // клиент предупредит, если ссылку правил админ
      });
    });

    it('шортс: прежний публичный URL поверх нового результата', () => {
      expect(plan({ current: SHORT_PUBLIC, incoming: 'https://s3.regru.cloud/trenki/shorts/old.mp4', requestedPublish: true, incomingHasJob: false })).toMatchObject({
        videoUrl: SHORT_PUBLIC,
        cancelJobs: false,
      });
    });

    it('ссылка поверх ещё обрабатываемого исходника тоже игнорируется', () => {
      expect(plan({ current: RAW_A, incoming: KINESCOPE, requestedPublish: true, incomingHasJob: false })).toMatchObject({
        videoUrl: RAW_A,
        isPublished: false,
        cancelJobs: false,
      });
    });
  });

  it('у старой записи ссылку Kinescope поменяли на другую: пишем, незавершённая замена отменяется', () => {
    expect(plan({ current: KINESCOPE, incoming: KINESCOPE_2, requestedPublish: true, incomingHasJob: false })).toMatchObject({
      videoUrl: KINESCOPE_2,
      isPublished: true,
      cancelJobs: true,
      ignoredIncoming: false,
    });
  });

  it('частичный PUT шортса без videoUrl и isPublished (тумблер закрепления) ничего не трогает', () => {
    expect(plan({ current: RAW_A, incoming: undefined, requestedPublish: undefined, incomingHasJob: false })).toEqual({
      videoUrl: undefined,
      isPublished: undefined,
      enqueueSource: null,
      cancelJobs: false,
      updatePublishIntent: false,
      ignoredIncoming: false,
    });
  });

  it('снятие публикации у обрабатываемого шортса запоминается как намерение', () => {
    expect(plan({ current: RAW_A, incoming: undefined, requestedPublish: false, incomingHasJob: false })).toMatchObject({
      isPublished: false,
      updatePublishIntent: true,
    });
  });

  it('обычное сохранение готового видео: всё как раньше', () => {
    expect(plan({ current: READY, incoming: READY, requestedPublish: false, incomingHasJob: false })).toMatchObject({
      videoUrl: READY,
      isPublished: false,
      enqueueSource: null,
      cancelJobs: false,
    });
  });
});
