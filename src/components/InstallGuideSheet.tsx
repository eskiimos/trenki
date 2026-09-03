'use client';

// Мини-инструкция «добавь Треньки на экран „Домой“» — нижний лист с двумя
// вкладками: iPhone/iPad и Android (правка владельца «Начало сентября»: раньше
// плашки были инертны, а шаги на платформах разные). Вкладка по умолчанию —
// по детекту платформы; на Android, если браузер отдал beforeinstallprompt,
// вместо шагов — кнопка «Установить» с нативным диалогом.

import { useEffect, useState } from 'react';
import {
  Share, SquarePlus, EllipsisVertical, Download, Compass, Check, X, type LucideIcon,
} from 'lucide-react';
import {
  isIOS, getDeferredPrompt, subscribeDeferredPrompt, promptInstall,
} from '@/lib/platform';

type Platform = 'ios' | 'android';

interface Step { Icon: LucideIcon; text: string }

const IOS_STEPS: Step[] = [
  { Icon: Compass, text: 'Открой trenki.app в Safari' },
  { Icon: Share, text: 'Нажми «Поделиться» — квадрат со стрелкой внизу экрана' },
  { Icon: SquarePlus, text: 'Выбери «На экран „Домой“»' },
  { Icon: Check, text: 'Нажми «Добавить» — иконка появится на экране' },
];
// PS владельца: на iOS можно и через Chrome
const IOS_NOTE = 'В Chrome на iPhone тоже работает: меню «⋯» → «Добавить на экран „Домой“».';

const ANDROID_STEPS: Step[] = [
  { Icon: Compass, text: 'Открой trenki.app в Chrome' },
  { Icon: EllipsisVertical, text: 'Открой меню «⋮» в правом верхнем углу' },
  { Icon: Download, text: 'Выбери «Установить приложение» или «Добавить на главный экран»' },
  { Icon: Check, text: 'Подтверди — Треньки появятся среди приложений' },
];

export default function InstallGuideSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>('android');
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlatform(isIOS() ? 'ios' : 'android');
    const update = () => setCanPrompt(!!getDeferredPrompt());
    update();
    return subscribeDeferredPrompt(update);
  }, [open]);

  if (!open) return null;

  const steps = platform === 'ios' ? IOS_STEPS : ANDROID_STEPS;

  const install = async () => {
    const ok = await promptInstall();
    if (ok) onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Как добавить Треньки на экран Домой"
      onClick={onClose}
      className="fixed inset-0 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 70 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full font-overpass"
        style={{
          maxWidth: 480,
          backgroundColor: '#101530',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 20px calc(env(safe-area-inset-bottom) + 24px)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-ink font-extrabold text-xl uppercase tracking-wide">
            Треньки на экран «Домой»
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-muted p-1 bg-transparent border-0 cursor-pointer"
          >
            <X size={22} aria-hidden />
          </button>
        </div>

        <div className="text-muted text-[13px] leading-snug mb-4">
          Приложение откроется с иконки, без браузерной строки, и сможет присылать напоминания.
        </div>

        {/* Две вкладки — платформы */}
        <div className="flex gap-2 mb-4" role="tablist">
          {(
            [
              ['ios', 'iPhone / iPad'],
              ['android', 'Android'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={platform === key}
              onClick={() => setPlatform(key)}
              className="uppercase flex-1 rounded-full font-extrabold text-[11px] tracking-[0.5px] py-2.5 px-3 transition-colors"
              style={{
                border: `1px solid ${platform === key ? 'var(--color-brand)' : '#2a2f4a'}`,
                background: platform === key ? 'var(--lime-medium)' : 'transparent',
                color: platform === key ? 'var(--color-brand)' : 'var(--color-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {platform === 'android' && canPrompt && (
          <button
            type="button"
            onClick={install}
            className="w-full rounded-full py-3.5 mb-4 text-sm font-black uppercase transition-transform active:scale-95"
            style={{ background: 'var(--color-brand)', color: 'var(--color-night)' }}
          >
            Установить
          </button>
        )}

        <ol className="flex flex-col gap-3">
          {steps.map(({ Icon, text }, i) => (
            <li key={text} className="flex gap-3">
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative"
                style={{ background: 'var(--lime-subtle)', color: 'var(--color-brand)' }}
              >
                <Icon size={18} aria-hidden />
                <span
                  className="absolute -top-1 -left-1 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center"
                  style={{ background: 'var(--color-brand)', color: 'var(--color-night)' }}
                >
                  {i + 1}
                </span>
              </span>
              <span className="text-ink text-sm leading-snug pt-2">{text}</span>
            </li>
          ))}
        </ol>

        {platform === 'ios' && (
          <div className="text-muted text-[12px] leading-snug mt-4">{IOS_NOTE}</div>
        )}
      </div>
    </div>
  );
}
