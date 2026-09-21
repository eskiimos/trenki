// Раскладка подписей над столбиками и под осью без наложений.
//
// Владелец просит видеть число над каждым столбиком, а не «прикидывать на
// глаз». Но 30 столбиков на телефоне — это ~8px на столбик: двузначное число
// шире своей колонки и налезает на соседние числа и на соседние (более
// высокие) столбики. Поэтому подписи расставляются жадно по приоритету (пик,
// потом всё меньшие значения): подпись, которая налезла бы на уже
// поставленную или на соседний столбик, пропускается — её значение видно по
// тапу на столбик. На широком экране помещаются все.
//
// Геометрия совпадает с CSS-гридом графика: repeat(n, minmax(0, 1fr)) +
// column-gap, т.е. ширина колонки = (W − (n−1)·gap) / n; столбик по центру
// колонки, не шире barWidthMax. Вертикаль — px от базовой линии вверх.

export interface ColumnGeometry {
  /** Число столбиков. */
  count: number;
  /** Ширина области графика, px. */
  width: number;
  /** Зазор между столбиками, px. */
  gap: number;
  /** Предел ширины столбика внутри колонки, px (по умолчанию — вся колонка). */
  barWidthMax?: number;
  /**
   * Высоты столбиков, px. Если заданы — подпись не может залезть на соседний
   * столбик, который выше её нижнего края (для подписей оси не нужны).
   */
  barHeights?: readonly number[];
}

export interface LabelCandidate {
  /** Номер столбика, над/под которым подпись. */
  index: number;
  text: string;
  /** Чем больше, тем раньше ставится (и тем вероятнее попадёт на экран). */
  priority: number;
  /** Нижний край подписи от базовой линии, px (над столбиком — его высота + зазор). */
  bottom?: number;
}

export interface PlacedLabel {
  index: number;
  text: string;
  /** Левый край подписи от левого края графика, px. */
  left: number;
  width: number;
  /** Нижний край от базовой линии, px. */
  bottom: number;
}

export interface LabelMetrics {
  /** Оценка ширины символа, px (цифры tabular-nums ≈ 0.6 от кегля). */
  charWidth: number;
  /** Высота строки подписи, px — для проверки наложения по вертикали. */
  lineHeight?: number;
  /** Поля слева и справа внутри подписи, px. */
  padding?: number;
  /** Минимальный просвет между соседними подписями, px. */
  minSpacing?: number;
}

export function columnWidth(g: ColumnGeometry): number {
  if (g.count <= 0) return 0;
  return Math.max(0, (g.width - (g.count - 1) * g.gap) / g.count);
}

export function columnCenter(g: ColumnGeometry, index: number): number {
  const w = columnWidth(g);
  return index * (w + g.gap) + w / 2;
}

/**
 * Жадная расстановка подписей: по убыванию приоритета, при равенстве — более
 * поздний столбик (свежие дни интереснее). Подпись центрируется над своим
 * столбиком и прижимается к краям графика, чтобы крайние не вылезали за
 * карточку (иначе на телефоне появляется горизонтальный скролл страницы).
 * Возвращает поставленные подписи по возрастанию index.
 */
export function placeColumnLabels(
  candidates: readonly LabelCandidate[],
  geometry: ColumnGeometry,
  metrics: LabelMetrics,
): PlacedLabel[] {
  const padding = metrics.padding ?? 1;
  const minSpacing = metrics.minSpacing ?? 2;
  const lineHeight = metrics.lineHeight ?? 12;
  if (geometry.width <= 0 || geometry.count <= 0) return [];

  const colW = columnWidth(geometry);
  const barW = Math.min(colW, geometry.barWidthMax ?? colW);

  const order = [...candidates]
    .filter((c) => c.index >= 0 && c.index < geometry.count && c.text.length > 0)
    .sort((a, b) => b.priority - a.priority || b.index - a.index);

  const placed: PlacedLabel[] = [];
  for (const c of order) {
    const width = c.text.length * metrics.charWidth + padding * 2;
    if (width > geometry.width) continue;
    const bottom = c.bottom ?? 0;
    const center = columnCenter(geometry, c.index);
    const left = Math.min(Math.max(0, center - width / 2), geometry.width - width);
    const right = left + width;

    const hitsLabel = placed.some(
      (p) =>
        left < p.left + p.width + minSpacing &&
        right + minSpacing > p.left &&
        // разные высоты (подписи над низким и высоким столбиком) не мешают
        bottom < p.bottom + lineHeight &&
        p.bottom < bottom + lineHeight,
    );
    if (hitsLabel) continue;

    let hitsBar = false;
    if (geometry.barHeights) {
      for (let j = 0; j < geometry.count && !hitsBar; j += 1) {
        if (j === c.index) continue;
        const cj = columnCenter(geometry, j);
        const overlapsX = left < cj + barW / 2 && right > cj - barW / 2;
        // Нужен хотя бы 1px воздуха между верхом чужого столбика и подписью
        if (overlapsX && (geometry.barHeights[j] ?? 0) + 1 > bottom) hitsBar = true;
      }
    }
    if (hitsBar) continue;

    placed.push({ index: c.index, text: c.text, left, width, bottom });
  }
  return placed.sort((a, b) => a.index - b.index);
}
