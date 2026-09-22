import { SKELETON_EDGES, hasPose, point2d } from '@/lib/pose/reference';

// Отрисовка скелета поверх видео. Видео в <video> вписано с object-fit:
// contain, поэтому считаем прямоугольник картинки внутри элемента.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function containRect(boxW: number, boxH: number, videoW: number, videoH: number): Rect {
  if (!videoW || !videoH) return { x: 0, y: 0, w: boxW, h: boxH };
  const scale = Math.min(boxW / videoW, boxH / videoH);
  const w = videoW * scale;
  const h = videoH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

const MIN_VIS = 0.5;

export function drawSkeleton(ctx: CanvasRenderingContext2D, frame: number[] | undefined, rect: Rect, dpr: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!frame || !hasPose(frame)) return;
  ctx.save();
  ctx.scale(dpr, dpr);
  const at = (i: number) => {
    const p = point2d(frame, i);
    return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h, v: p.v };
  };
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  // Контур под линией — скелет читается и на светлом, и на тёмном кадре
  for (const pass of [0, 1] as const) {
    ctx.strokeStyle = pass === 0 ? 'rgba(6,9,25,0.85)' : '#A1FF4A';
    ctx.lineWidth = pass === 0 ? 6 : 3;
    for (const [a, b] of SKELETON_EDGES) {
      const pa = at(a);
      const pb = at(b);
      if (pa.v < MIN_VIS || pb.v < MIN_VIS) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }
  for (let i = 11; i <= 32; i++) {
    const p = at(i);
    if (p.v < MIN_VIS) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#F9F8FE';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#060919';
    ctx.stroke();
  }
  ctx.restore();
}
