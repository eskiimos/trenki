'use client';

import { useSubscription } from '@/hooks/useSubscription';
import { openSubscriptionModal } from '@/lib/subscription-modal';

// Голубой островок на главной (п.1): «раскрой свой потенциал с подпиской».
// Показывается только когда paywall активен для юзера (режим obкатки уважается):
// в 'off' — никому, в 'admins' — только админам, в 'on' — всем без премиума.
export default function PotentialIslandBanner() {
  const { paywalled, loading } = useSubscription();
  if (loading || !paywalled) return null;

  return (
    <section className="px-4" style={{ paddingTop: 4, paddingBottom: 15 }}>
      <button
        type="button"
        onClick={() => openSubscriptionModal('generic')}
        className="w-full transition-transform active:scale-[0.99]"
        style={{
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '18px 16px',
          borderRadius: 16,
          border: '1px solid rgba(161,255,74,0.35)',
          background: 'linear-gradient(120deg, #445CFF 0%, #4C5EF0 55%, #2E7BE6 100%)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Лого-волна (пока — инлайн-SVG в брендовых цветах, потом заменим ассетом из Figma) */}
        <svg
          aria-hidden
          viewBox="0 0 200 80"
          style={{ position: 'absolute', right: -10, bottom: -10, width: 180, height: 90, opacity: 0.25 }}
        >
          <path
            d="M0 50 Q 30 20 60 45 T 120 45 T 200 40"
            fill="none"
            stroke="#A1FF4A"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>

        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(161,255,74,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          ⚡️
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
          <div
            className="font-overpass uppercase"
            style={{ color: '#F9F8FE', fontWeight: 900, fontSize: 15, lineHeight: 1.2, letterSpacing: 0.3 }}
          >
            Раскрой свой потенциал<br />
            <span style={{ color: '#A1FF4A' }}>с подпиской</span>
          </div>
          <div style={{ color: 'rgba(249,248,254,0.8)', fontSize: 12, marginTop: 4 }}>
            Все тренировки, календарь и шкала прогресса →
          </div>
        </div>
      </button>
    </section>
  );
}
