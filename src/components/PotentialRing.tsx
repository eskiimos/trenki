'use client';

// Переиспользуемое «кольцо потенциала»: 5 характеристик + общий потенциал
// (визуал — PotentialSection, pure CSS/SVG). Добавляет поверх него
// paywall-поведение из /profile: при grayed блок серый/размытый и цифры
// скрыты («Для FREE/paywalled потенциал серый и цифры скрыты»).
// Используется в /profile (grayed = paywalled) и в родительском кабинете
// /parent (grayed = false — родитель видит всё).
//
// Scale-to-fit: макет PotentialSection свёрстан «пиксель-в-пиксель» под
// Figma и рассчитан на ширину ~358px (фрейм 390px минус боковые отступы
// 16+16 страницы профиля). В более узком контейнере (например, карточка
// родительского кабинета, ~330px) лейблы переносятся и раскладка ломается.
// Поэтому: если контейнер уже INTRINSIC_WIDTH — рендерим секцию на её
// «родной» ширине и уменьшаем целиком через transform: scale(k), а внешнему
// блоку задаём высоту intrinsicHeight * k, чтобы под ним не оставалось
// пустого места. Если контейнер >= INTRINSIC_WIDTH — k = 1, никаких
// трансформаций, поведение и внешний вид (в т.ч. на /profile) не меняются.

import { useLayoutEffect, useRef, useState } from 'react';
import PotentialSection from '@/components/PotentialSection';

// «Родная» ширина макета PotentialSection: 390 (iPhone-фрейм из Figma)
// минус 16+16 боковых отступов страницы профиля. Ниже этой ширины
// начинается перенос лейблов и разваливание строк характеристик.
const INTRINSIC_WIDTH = 358;

export interface PotentialRingRatings {
  power?: number | null;
  speed?: number | null;
  endurance?: number | null;
  technique?: number | null;
  flexibility?: number | null;
}

export interface PotentialRingProps {
  ratings: PotentialRingRatings;
  potential?: number | null;
  /** Серый/размытый режим для FREE/paywalled (как в /profile) */
  grayed?: boolean;
  /** Недавний прирост характеристик — зелёные «+0.4» над цифрами */
  gains?: {
    endurance?: number;
    technique?: number;
    power?: number;
    speed?: number;
    flexibility?: number;
  };
}

export default function PotentialRing({
  ratings,
  potential,
  grayed = false,
  gains,
}: PotentialRingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  // SSR-безопасный дефолт: до первого замера k = 1 — рендер идентичен
  // прежнему (без transform), гидрация ничего не ломает.
  const [scale, setScale] = useState(1);
  // «Натуральная» высота внутреннего блока (offsetHeight не учитывает
  // transform) — нужна, чтобы схлопнуть внешний блок до intrinsicHeight * k.
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const update = () => {
      const w = container.clientWidth;
      // Контейнер уже «родной» ширины → уменьшаем пропорционально.
      setScale(w > 0 && w < INTRINSIC_WIDTH ? w / INTRINSIC_WIDTH : 1);
      // offsetHeight игнорирует transform: это высота макета «как есть».
      setInnerHeight(inner.offsetHeight);
    };

    // Первый замер — синхронно до отрисовки (useLayoutEffect), чтобы не
    // мигнуть сломанной раскладкой в узком контейнере.
    update();

    // Следим и за контейнером (изменилась доступная ширина), и за внутренним
    // блоком (изменилась натуральная высота — напр., появились gains).
    const ro = new ResizeObserver(update);
    ro.observe(container);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const isScaled = scale < 1;

  return (
    <div
      ref={containerRef}
      style={{
        ...(grayed
          ? { filter: 'grayscale(1) blur(6px)', opacity: 0.5, pointerEvents: 'none' as const, userSelect: 'none' as const }
          : undefined),
        ...(isScaled
          ? {
              // Высота = натуральная высота макета × коэффициент масштаба,
              // чтобы под уменьшенным блоком не было «мёртвой» зоны.
              height: innerHeight > 0 ? innerHeight * scale : undefined,
              // Внутренний блок шире контейнера по layout-ширине (358px),
              // визуально он ужат transform'ом — прячем layout-переполнение.
              overflow: 'hidden',
            }
          : undefined),
      }}
      aria-hidden={grayed}
    >
      <div
        ref={innerRef}
        style={
          isScaled
            ? {
                // Фиксируем «родную» ширину макета и ужимаем целиком:
                // пропорции Figma-вёрстки сохраняются на любом экране.
                width: INTRINSIC_WIDTH,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }
            : undefined
        }
      >
        <PotentialSection
          ratingEndurance={ratings.endurance ?? undefined}
          ratingTechnique={ratings.technique ?? undefined}
          ratingPower={ratings.power ?? undefined}
          ratingSpeed={ratings.speed ?? undefined}
          ratingFlexibility={ratings.flexibility ?? undefined}
          potential={potential ?? undefined}
          gains={gains}
        />
      </div>
    </div>
  );
}
