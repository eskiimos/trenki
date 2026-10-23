interface VideoClientBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Map a CSS-pixel tap through object-fit: contain into the unmirrored source frame. */
export function videoPointFromClient(
  clientX: number,
  clientY: number,
  box: VideoClientBox,
  sourceWidth: number,
  sourceHeight: number,
  mirrored: boolean,
): { x: number; y: number } | null {
  if (![clientX, clientY, box.left, box.top, box.width, box.height, sourceWidth, sourceHeight].every(Number.isFinite)
    || box.width <= 0 || box.height <= 0 || sourceWidth <= 0 || sourceHeight <= 0) return null;

  const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  const x = (clientX - left) / width;
  const y = (clientY - top) / height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: mirrored ? 1 - x : x, y };
}
