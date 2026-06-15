'use client';

// Маркетинговый лендинг «Треньки». Публичный роут (см. middleware publicRoutes).
// Пока живёт на /landing; позже можно сделать пред-логин главной.
// Тёмная тема бренда: #060919/#101530, лайм #A1FF4A, синий #445CFF, Overpass,
// фирменная волна (MicrocycleWave).

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MicrocycleWave from '@/components/MicrocycleWave';

// Появление секции при скролле (IntersectionObserver).
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

const FEATURES = [
  {
    emoji: '🤖',
    title: 'Персональный ИИ-тренер',
    body: 'Отвечаешь, как себя чувствуешь, — ИИ собирает тренировку под твоё состояние и цель.',
  },
  {
    emoji: '⚡️',
    title: 'Микроцикл на неделю',
    body: 'Один тап — готовый план на 5 дней: от разминки до пиковой нагрузки и восстановления.',
  },
  {
    emoji: '🎬',
    title: 'Разборы и треньки',
    body: 'Короткие видео от профи: техника, советы, разбор игровых моментов.',
  },
  {
    emoji: '🏒',
    title: 'Работа с тренером',
    body: 'Личный тренер ставит задания — ты видишь их в календаре и получаешь напоминания.',
  },
  {
    emoji: '📈',
    title: 'Рост потенциала',
    body: 'Сила, скорость, выносливость, техника и гибкость растут с каждой тренировкой.',
  },
  {
    emoji: '📅',
    title: 'Календарь и ритм',
    body: 'Вся неделя перед глазами. Тренируйся системно и держи форму к играм.',
  },
];

const STEPS = [
  { n: '01', title: 'Пройди короткий опрос', body: 'Расскажи о себе и форме — это займёт минуту.' },
  { n: '02', title: 'ИИ соберёт твою неделю', body: 'Микроцикл из 5 тренировок под твой уровень.' },
  { n: '03', title: 'Тренируйся и расти', body: 'Следи, как растёт потенциал, и адаптируй нагрузку.' },
];

export default function LandingPage() {
  return (
    <div style={{ background: '#060919', color: '#F9F8FE', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* NAV */}
      <header
        className="flex items-center justify-between"
        style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px', maxWidth: 1120, margin: '0 auto' }}
      >
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-app.svg" alt="Треньки" width={32} height={32} style={{ borderRadius: 6 }} />
          <span className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.08em' }}>
            треньки
          </span>
        </div>
        <Link
          href="/login"
          className="font-overpass uppercase transition-transform active:scale-95"
          style={{
            background: 'rgba(161,255,74,0.12)',
            color: '#A1FF4A',
            border: '1px solid rgba(161,255,74,0.3)',
            borderRadius: 999,
            padding: '8px 18px',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.05em',
          }}
        >
          Войти
        </Link>
      </header>

      {/* HERO */}
      <section
        className="relative flex flex-col items-center text-center"
        style={{
          padding: '48px 20px 40px',
          background:
            'radial-gradient(circle at 50% 0%, rgba(161,255,74,0.18) 0%, rgba(6,9,25,0) 55%), radial-gradient(circle at 50% 40%, rgba(68,92,255,0.16) 0%, rgba(6,9,25,0) 60%)',
        }}
      >
        <div
          className="font-overpass uppercase animate-fadeIn"
          style={{ color: '#A1FF4A', fontWeight: 800, fontSize: 12, letterSpacing: '0.35em', marginBottom: 18 }}
        >
          твой цифровой тренер
        </div>
        <h1
          className="font-overpass uppercase animate-popIn"
          style={{
            fontWeight: 900,
            fontSize: 'clamp(40px, 12vw, 88px)',
            lineHeight: '92%',
            letterSpacing: '0.02em',
            margin: 0,
            maxWidth: 900,
          }}
        >
          Хоккей.<br />
          Каждый день{' '}
          <span style={{ color: '#A1FF4A' }}>сильнее</span>.
        </h1>
        <p
          className="font-overpass animate-fadeIn"
          style={{
            color: '#AEABBB',
            fontSize: 'clamp(15px, 4vw, 19px)',
            lineHeight: 1.5,
            maxWidth: 560,
            marginTop: 20,
            animationDelay: '0.15s',
          }}
        >
          ИИ-тренер собирает тебе неделю тренировок под твою форму — от разминки до пиковой
          нагрузки. Тренируйся как профи прямо со смартфона.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 28 }}>
          <Link
            href="/login"
            className="font-overpass uppercase transition-transform active:scale-95"
            style={{
              background: '#A1FF4A',
              color: '#060919',
              borderRadius: 999,
              padding: '16px 32px',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '0.04em',
              boxShadow: '0 8px 30px rgba(161,255,74,0.25)',
            }}
          >
            Начать бесплатно
          </Link>
          <a
            href="#how"
            className="font-overpass uppercase transition-transform active:scale-95"
            style={{
              background: 'transparent',
              color: '#F9F8FE',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              padding: '16px 28px',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.04em',
            }}
          >
            Как это работает
          </a>
        </div>

        {/* Фирменная волна-неделя */}
        <div className="w-full flex justify-center" style={{ marginTop: 44, maxWidth: 520 }}>
          <MicrocycleWave />
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '40px 20px', maxWidth: 1120, margin: '0 auto' }}>
        <Reveal>
          <h2
            className="font-overpass uppercase text-center"
            style={{ fontWeight: 900, fontSize: 'clamp(26px, 7vw, 44px)', lineHeight: '100%', marginBottom: 8 }}
          >
            Всё для прогресса
          </h2>
          <p className="font-overpass text-center" style={{ color: '#AEABBB', fontSize: 15, marginBottom: 36 }}>
            Один аппликейшн вместо тренера, методиста и дневника
          </p>
        </Reveal>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(68,92,255,0.10) 0%, rgba(16,21,48,0.6) 100%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 18,
                  padding: 22,
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(161,255,74,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    marginBottom: 14,
                  }}
                >
                  {f.emoji}
                </div>
                <h3 className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 16, marginBottom: 8, letterSpacing: '0.02em' }}>
                  {f.title}
                </h3>
                <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5 }}>
                  {f.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SHORTS SHOWCASE */}
      <section style={{ padding: '24px 20px 48px', maxWidth: 1120, margin: '0 auto' }}>
        <Reveal>
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(161,255,74,0.10) 0%, rgba(68,92,255,0.16) 100%)',
              border: '1px solid rgba(161,255,74,0.2)',
              borderRadius: 24,
              padding: '28px 22px',
            }}
          >
            <h2 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 'clamp(22px, 6vw, 34px)', marginBottom: 8 }}>
              Учись у профи
            </h2>
            <p className="font-overpass text-center" style={{ color: '#AEABBB', fontSize: 14, marginBottom: 22 }}>
              Короткие разборы техники и игровых моментов
            </p>
            <div className="flex justify-center gap-3 flex-wrap">
              {['shorts_1', 'shorts_2', 'shorts_3', 'shorts_4'].map((s) => (
                <div
                  key={s}
                  className="relative overflow-hidden"
                  style={{ width: 120, aspectRatio: '9 / 16', borderRadius: 12, background: '#101530', flexShrink: 0 }}
                >
                  <Image src={`/images/preview_shorts/${s}.png`} alt="Разбор" fill className="object-cover" sizes="120px" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: '40px 20px', maxWidth: 1120, margin: '0 auto', scrollMarginTop: 24 }}>
        <Reveal>
          <h2 className="font-overpass uppercase text-center" style={{ fontWeight: 900, fontSize: 'clamp(26px, 7vw, 44px)', marginBottom: 36 }}>
            Как это работает
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div style={{ padding: 22, borderRadius: 18, background: 'rgba(16,21,48,0.5)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
                <div className="font-overpass" style={{ color: '#445CFF', fontWeight: 900, fontSize: 36, lineHeight: 1, marginBottom: 12 }}>
                  {s.n}
                </div>
                <h3 className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
                  {s.title}
                </h3>
                <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5 }}>
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '24px 20px 64px', maxWidth: 1120, margin: '0 auto' }}>
        <Reveal>
          <div
            className="text-center"
            style={{
              background: 'radial-gradient(circle at 50% 0%, rgba(161,255,74,0.18) 0%, rgba(6,9,25,0) 70%), #0B1030',
              border: '1px solid rgba(161,255,74,0.25)',
              borderRadius: 28,
              padding: '48px 24px',
            }}
          >
            <h2 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(28px, 8vw, 48px)', lineHeight: '100%', marginBottom: 14 }}>
              Готов стать{' '}
              <span style={{ color: '#A1FF4A' }}>сильнее</span>?
            </h2>
            <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 16, marginBottom: 26, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Создай первую неделю тренировок прямо сейчас — это бесплатно.
            </p>
            <Link
              href="/login"
              className="font-overpass uppercase inline-block transition-transform active:scale-95"
              style={{
                background: '#A1FF4A',
                color: '#060919',
                borderRadius: 999,
                padding: '17px 40px',
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: '0.04em',
                boxShadow: '0 8px 30px rgba(161,255,74,0.3)',
              }}
            >
              Начать бесплатно
            </Link>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '24px 20px calc(env(safe-area-inset-bottom, 0px) + 28px)',
          maxWidth: 1120,
          margin: '0 auto',
        }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-app.svg" alt="" width={24} height={24} style={{ borderRadius: 5 }} />
          <span className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: '#AEABBB' }}>
            треньки
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/legal/terms" className="font-overpass" style={{ color: '#AEABBB', fontSize: 13 }}>
            Документы
          </Link>
          <Link href="/login" className="font-overpass" style={{ color: '#AEABBB', fontSize: 13 }}>
            Войти
          </Link>
        </div>
        <div className="font-overpass w-full sm:w-auto" style={{ color: '#5B5A68', fontSize: 12 }}>
          © 2026 Треньки
        </div>
      </footer>
    </div>
  );
}
