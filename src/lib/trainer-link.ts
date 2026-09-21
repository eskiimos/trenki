// Ссылка на страницу тренера из карточки видео (правки «Середина сентября», п.2).
// У видео с соавторами ведём на ведущего тренера — того, кто показан в карточке
// (video.trainer); полный список соавторов живёт в плеере (TagsSection).

/** Путь до страницы тренера или null, если id не пришёл (старый ответ API / кэш PWA). */
export function trainerProfileHref(trainer: { id?: string | null } | null | undefined): string | null {
  const id = trainer?.id?.trim();
  if (!id) return null;
  return `/trainers/${encodeURIComponent(id)}`;
}
