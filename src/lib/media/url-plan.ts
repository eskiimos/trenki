// Чистые правила: что делать с videoUrl/isPublished при сохранении карточки
// видео или шортса, когда в игре сырые исходники (s3://uploads/...).
// Покрыто unit-тестами (tests/lib/media-url-plan.test.ts).
//
// Инварианты:
// 1. Строка, чей videoUrl — сырой исходник, НЕ опубликована: исходник (2.7K
//    .mov, 12 Мбит/с, без faststart) у пользователей не играет. Публикацию,
//    которую просил админ, воркер применит после обработки (publishOnReady).
// 2. У ГОТОВОГО видео новый исходник в videoUrl не пишется, пока не обработан:
//    все созданные тренировки/задания читают Video.videoUrl в момент просмотра
//    и получили бы сырой файл. Пользователи смотрят старый файл до подмены.
// 3. Форма, открытая до окончания обработки, может прислать устаревший URL:
//    уже обработанный исходник (по нему есть задача) или прежний файл, который
//    воркер подменил. Такой URL игнорируем — иначе запись осталась бы без файла.
//    Ссылку у записи в нашем хранилище админка не редактирует (поле скрыто),
//    поэтому «обычный URL поверх нашего файла» — всегда устаревшая форма.

export const RAW_UPLOAD_PREFIX = 's3://uploads/';

export function isRawUploadUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith(RAW_UPLOAD_PREFIX) && url.length > RAW_UPLOAD_PREFIX.length;
}

export interface UrlUpdateInput {
  /** videoUrl строки в БД сейчас. */
  current: string;
  /** videoUrl из запроса; undefined — поле не прислали (частичный PUT шортса). */
  incoming: string | undefined;
  /** isPublished из запроса; undefined — не прислали. */
  requestedPublish: boolean | undefined;
  /** Есть ли уже задача обработки с sourceUrl === incoming (признак устаревшей формы). */
  incomingHasJob: boolean;
  /** current — объект нашего бакета (s3:// или публичный https бакета). */
  currentInOwnStorage: boolean;
}

export interface UrlUpdatePlan {
  /** Что записать в videoUrl (undefined — не трогать). */
  videoUrl: string | undefined;
  /** Что записать в isPublished (undefined — не трогать). */
  isPublished: boolean | undefined;
  /** Поставить в очередь обработку этого исходника (отменив прежние задачи цели). */
  enqueueSource: string | null;
  /** Отменить активные задачи цели (админ сменил файл на ссылку). */
  cancelJobs: boolean;
  /** Обновить publishOnReady активной задачи на requestedPublish. */
  updatePublishIntent: boolean;
  /** Присланный videoUrl отброшен как устаревший (клиент может предупредить админа). */
  ignoredIncoming: boolean;
}

export function planUrlUpdate(input: UrlUpdateInput): UrlUpdatePlan {
  const { current, requestedPublish, incomingHasJob, currentInOwnStorage } = input;
  const changed = input.incoming !== undefined && input.incoming !== current;
  const staleForm =
    changed &&
    (isRawUploadUrl(input.incoming)
      ? incomingHasJob // исходник, по которому уже была задача
      : currentInOwnStorage); // обычный URL поверх нашего файла
  // Устаревшая форма — считаем, что videoUrl не менялся.
  const incoming = staleForm ? current : input.incoming;

  const plan: UrlUpdatePlan = {
    videoUrl: undefined,
    isPublished: requestedPublish,
    enqueueSource: null,
    cancelJobs: false,
    updatePublishIntent: false,
    ignoredIncoming: staleForm,
  };

  if (incoming === undefined || incoming === current) {
    if (isRawUploadUrl(current)) {
      // Всё ещё обрабатывается: публикация — только намерение.
      plan.isPublished = requestedPublish === undefined ? undefined : false;
    }
    plan.updatePublishIntent = requestedPublish !== undefined;
    if (incoming !== undefined) plan.videoUrl = current;
    return plan;
  }

  if (isRawUploadUrl(incoming)) {
    plan.enqueueSource = incoming;
    if (isRawUploadUrl(current)) {
      // Видео ещё не готово, админ загрузил другой файл: заменяем исходник.
      plan.videoUrl = incoming;
      plan.isPublished = requestedPublish === undefined ? undefined : false;
    } else {
      // Готовое видео (или старая ссылка Kinescope): оставляем текущий файл
      // живым до конца обработки нового.
      plan.videoUrl = current;
    }
    return plan;
  }

  // Сторонняя ссылка (Kinescope) у старой записи поменялась на другую: пишем
  // как есть, незавершённая замена файлом больше не нужна.
  plan.videoUrl = incoming;
  plan.cancelJobs = true;
  return plan;
}
