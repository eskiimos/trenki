'use client';

// Продающая страница «Треньки» (v2 — редакторская левая вёрстка + микроанимации).
// Публичный роут (middleware publicRoutes). Тёмная тема бренда, лайм #A1FF4A /
// синий #445CFF, Overpass, пиксель-мокапы реальных экранов в телефон-фреймах,
// реальные компоненты MicrocycleWave и PotentialSection.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const LIME = '#A1FF4A';
const BLUE = '#445CFF';

// ── helpers ──────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => { if (e[0].isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(28px) scale(0.985)',
        transition: `opacity .65s ease ${delay}s, transform .75s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function CountUp({ target, duration = 1100, suffix = '' }: { target: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && !started) {
        started = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

function Phone({ children, width = 290, className = '' }: { children: React.ReactNode; width?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width, maxWidth: '86vw', borderRadius: 38, padding: 10,
        background: 'linear-gradient(160deg, #20264a 0%, #0a0e22 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 60px rgba(68,92,255,0.18)',
        flexShrink: 0,
      }}
    >
      {/* aspectRatio подогнан под реальные скриншоты (~0.46 = 403/875), чтобы
          экран влезал целиком без обрезки низа (кнопки) */}
      <div style={{ borderRadius: 30, background: '#060919', overflow: 'hidden', position: 'relative', aspectRatio: '403 / 875' }}>
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 90, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.18)', zIndex: 5 }} />
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 34, maxWidth: 760 }}>
      {eyebrow && (
        <div className="font-overpass uppercase flex items-center" style={{ color: LIME, fontWeight: 800, fontSize: 12, letterSpacing: '0.22em', marginBottom: 14 }}>
          <span className="lp-dot" />{eyebrow}
        </div>
      )}
      <h2 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(28px, 7vw, 48px)', lineHeight: '98%', letterSpacing: '0.01em', margin: 0 }}>
        {title}
      </h2>
      {sub && <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 'clamp(14px,3.6vw,17px)', marginTop: 12, maxWidth: 560 }}>{sub}</p>}
    </div>
  );
}

// Слот под скриншот реального экрана в телефон-фрейме. Если файл
// /public/landing/screens/<screen>.png есть — показываем его; иначе пустой
// слот с подписью (заменить, когда подвезут скриншоты).
function PhoneShot({ screen, label }: { screen: string; label: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div
        className="font-overpass uppercase"
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(249,248,254,0.22)', fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          background: '#060919', textAlign: 'center', padding: 16,
        }}
      >
        {label}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/screens/${screen}.webp`}
      alt={label}
      onError={() => setOk(false)}
      // contain + inset:0 — показываем экран целиком (низ не режем), надёжно
      // заполняем фрейм без зависимости от %-height (фикс Safari/aspect-ratio)
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
    />
  );
}

const ctaStyle: React.CSSProperties = {
  background: LIME, color: '#060919', borderRadius: 999, padding: '16px 34px',
  fontWeight: 900, fontSize: 15, letterSpacing: '0.04em', display: 'inline-block',
};

// ── мокапы экранов ───────────────────────────────────────────────────
// ── data ─────────────────────────────────────────────────────────────
const PAINS = [
  { emoji: '🤷', t: 'Тренируешься без системы', b: 'Упражнения из интернета наугад — без плана и прогрессии.' },
  { emoji: '📺', t: 'YouTube не знает тебя', b: 'Ролики «для всех» не учитывают твою позицию, форму и уровень.' },
  { emoji: '💸', t: 'Личный тренер — дорого', b: 'Индивидуальные занятия не всем по карману и не всегда рядом.' },
  { emoji: '📉', t: 'Не видишь прогресс', b: 'Непонятно — растёшь ты или топчешься на месте.' },
];

const FEATURES = [
  { screen: 'assessment', w: 280, eyebrow: 'ИИ-тренер', title: 'Тренировка под тебя за минуту', body: 'Выбирай цель и отмечай, как себя чувствуешь — ИИ соберёт персональную тренировку из модулей: разминка, физподготовка, техника, заминка. Под твои возраст, уровень, позицию и состояние.', bullets: ['Учитывает форму и усталость', 'Цель: бросок, скорость, борьба…', 'Никаких случайных видео'] },
  { screen: 'catalog', w: 280, eyebrow: 'Каталог', title: '60+ видео-занятий под рукой', body: 'Техника, физ подготовка и теория — от реальных тренеров. Фильтруй по цели, типу нагрузки и тренеру, добавляй в избранное.', bullets: ['60+ занятий и каталог растёт', 'Поиск по цели и тренеру', 'Разминка · ФП · техника · теория'] },
  { screen: 'calendar', w: 280, eyebrow: 'Микроцикл', title: 'Целая неделя одним тапом', body: 'ИИ-тренер составляет недельный план по методике профи: от разминки к пиковой нагрузке и восстановлению перед играми. Всё в календаре.', bullets: ['5 тренировок на неделю', 'Нагрузка распределена грамотно', 'Адаптируется по твоему отклику'] },
  { screen: 'profile', w: 340, eyebrow: 'Прогресс', title: 'Видно, как ты растёшь', body: 'Сила, скорость, выносливость, техника и гибкость — пять характеристик, которые растут с каждой тренировкой. Общий потенциал — одно понятное число.', bullets: ['5 характеристик игрока', 'Кольцо общего потенциала', 'Прирост за каждую тренировку'] },
  { screen: 'workout', w: 280, eyebrow: 'Тренировки', title: 'Структурно, как у профи', body: 'Каждая тренировка — это модули с понятной длительностью и целью. Проходишь по очереди, отмечаешь выполнение, копишь прогресс.', bullets: ['Разминка → ФП/техника → заминка', 'Видео-упражнения от тренеров', 'Таймер и прогресс по модулям'] },
];

const FOR_WHOM = [
  { emoji: '🏒', t: 'Игроку', b: 'Тренируйся системно между командными занятиями и прогрессируй быстрее сверстников.' },
  { emoji: '👨‍👩‍👦', t: 'Родителю', b: 'Дай ребёнку персональную программу без затрат на личного тренера.' },
  { emoji: '🧑‍🏫', t: 'Тренеру', b: 'Ставь задания команде и следи за прогрессом каждого игрока.' },
];

const ROADMAP_NOW = [
  'Составляй одиночные полноценные тренировки индивидуально под себя и свою цель',
  'Составляй физиологически правильные тренировочные микроциклы',
  'Отслеживай прогресс: общий потенциал и 5 отдельных характеристик',
  'Командные комнаты — получай задания от своего тренера прямо в приложении',
];
const ROADMAP_SOON = [
  'Интеграция с носимыми устройствами: данные о здоровье и переносимости нагрузок',
  'Игровая статистика, таблицы лидеров, внутренние соревнования',
  'Расписание и запись на «подкатку» к любимому тренеру',
];

const FAQ = [
  { q: 'Сколько это стоит?', a: 'Старт бесплатный — собери первую неделю и тренируйся. Базовые возможности доступны без оплаты, без банковской карты и скрытых списаний.' },
  { q: 'Подойдёт новичку?', a: 'Да. ИИ подбирает нагрузку под твой уровень и состояние — от первых шагов до продвинутого.' },
  { q: 'Нужен ли инвентарь?', a: 'Большинство тренировок — с минимальным оборудованием. Подбор учитывает, что у тебя есть.' },
  { q: 'Нужен ли свой тренер?', a: 'Нет, «Треньки» работают самостоятельно. Но если тренер есть — он может ставить тебе задания.' },
  { q: 'Это приложение или сайт?', a: 'Это PWA — открывается в браузере и ставится на главный экран как приложение, без магазинов.' },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen((v) => !v)} className="lp-card w-full text-left"
      style={{ background: 'rgba(16,21,48,0.5)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px' }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-overpass" style={{ fontWeight: 700, fontSize: 15, color: '#F9F8FE' }}>{q}</span>
        <span style={{ color: LIME, fontSize: 22, lineHeight: 1, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }}>+</span>
      </div>
      {open && <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5, marginTop: 12 }}>{a}</p>}
    </button>
  );
}

const MARQUEE = ['Мощный бросок', 'Скорость', 'Выносливость', 'Техника', 'Сила', 'Ловкость', 'Теория', 'Реакция'];

export default function LandingPage() {
  return (
    <div style={{ background: '#060919', color: '#F9F8FE', minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>
      {/* NAV */}
      <header className="sticky top-0 z-50 flex items-center justify-between"
        style={{ padding: '12px clamp(16px,5vw,40px)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', maxWidth: 1200, margin: '0 auto', backdropFilter: 'blur(12px)', background: 'rgba(6,9,25,0.65)' }}>
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-app.svg" alt="Треньки" width={30} height={30} style={{ borderRadius: 6 }} />
          <span className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.08em' }}>треньки</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="font-overpass uppercase hidden sm:inline-block" style={{ color: '#AEABBB', fontSize: 12, fontWeight: 700, padding: '8px 12px' }}>Войти</Link>
          <Link href="/login" className="lp-cta font-overpass uppercase" style={{ background: LIME, color: '#060919', borderRadius: 999, padding: '9px 18px', fontWeight: 800, fontSize: 12, letterSpacing: '0.04em' }}>Начать</Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative" style={{ padding: 'clamp(36px,7vw,72px) clamp(16px,5vw,40px) 24px' }}>
        {/* aurora */}
        <div className="lp-aurora lp-a1" />
        <div className="lp-aurora lp-a2" />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }} className="flex flex-col lg:flex-row items-start lg:items-center gap-12">
          <div style={{ flex: 1.1, width: '100%' }}>
            <div className="font-overpass uppercase flex items-center" style={{ color: LIME, fontWeight: 800, fontSize: 'clamp(11px,3vw,13px)', letterSpacing: '0.28em', marginBottom: 18 }}>
              <span className="lp-dot" />цифровая среда для развития хоккеиста
            </div>
            <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(40px, 11vw, 84px)', lineHeight: '90%', letterSpacing: '0.005em', margin: 0 }}>
              Стань<br /><span className="lp-shimmer">сильнее</span><br />на льду
            </h1>
            <p className="font-overpass" style={{ color: '#C9C7D4', fontSize: 'clamp(15px,4vw,20px)', lineHeight: 1.5, maxWidth: 500, marginTop: 22 }}>
              ИИ-тренер собирает персональные тренировки и целую неделю плана — под твою позицию, форму и цель. Прямо со смартфона.
            </p>
            <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
              <Link href="/login" className="lp-cta font-overpass uppercase" style={ctaStyle}>Начать бесплатно</Link>
              <a href="#features" className="font-overpass uppercase lp-ghost" style={{ color: '#F9F8FE', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '16px 26px', fontWeight: 800, fontSize: 14 }}>Смотреть фичи</a>
            </div>
            <div className="font-overpass" style={{ color: '#8C8A99', fontSize: 12, marginTop: 16 }}>Бесплатный старт · Без банковской карты · Работает в браузере</div>

            {/* stats */}
            <div className="grid grid-cols-3 gap-3" style={{ marginTop: 36, maxWidth: 460 }}>
              {[[60, '+', 'видео-занятий на платформе'], [5, '', 'характеристик — следишь за прогрессом'], [1, '', 'клик до тренировки или плана']].map(([n, suf, t], i) => (
                <div key={i} className="lp-card" style={{ background: 'rgba(16,21,48,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 10px' }}>
                  <div className="font-overpass" style={{ color: LIME, fontWeight: 900, fontSize: 'clamp(26px,7vw,40px)', lineHeight: 1 }}><CountUp target={n as number} suffix={suf as string} /></div>
                  <div className="font-overpass" style={{ color: '#AEABBB', fontSize: 10, marginTop: 6, lineHeight: 1.3 }}>{(t as string).trim()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center w-full lg:w-auto" style={{ flex: 1 }}>
            <Phone width={300} className="lp-float"><PhoneShot screen="catalog" label="Каталог" /></Phone>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 0', overflow: 'hidden', background: 'rgba(16,21,48,0.3)' }}>
        <div className="lp-marquee" style={{ display: 'inline-flex', whiteSpace: 'nowrap' }}>
          {[...MARQUEE, ...MARQUEE].map((w, i) => (
            <span key={i} className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.1em', color: i % 2 ? '#3A4570' : '#AEABBB', padding: '0 22px' }}>
              {w} <span style={{ color: LIME }}>·</span>
            </span>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <section style={{ padding: 'clamp(48px,9vw,80px) clamp(16px,5vw,40px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="знакомо?" title={<>Прогрессировать в&nbsp;одиночку — тяжело</>} /></Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 16 }}>
          {PAINS.map((p, i) => (
            <Reveal key={p.t} delay={(i % 4) * 0.06}>
              <div className="lp-card" style={{ background: 'rgba(16,21,48,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: 22, height: '100%' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{p.emoji}</div>
                <h3 className="font-overpass" style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{p.t}</h3>
                <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5 }}>{p.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(22px,6vw,36px)', lineHeight: '118%', maxWidth: 760, marginTop: 44 }}>
            «Треньки» — это <span style={{ color: LIME }}>персональный тренер</span> в твоём смартфоне
          </p>
        </Reveal>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '8px clamp(16px,5vw,40px) 32px', maxWidth: 1200, margin: '0 auto', scrollMarginTop: 70 }}>
        {FEATURES.map((f, i) => (
          <Reveal key={f.title}>
            <div className={`flex flex-col items-center gap-10 w-full ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
              style={{ padding: 'clamp(28px,6vw,52px) 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-center" style={{ flex: 1 }}>
                <Phone width={f.w} className={i % 2 === 0 ? 'lp-float' : 'lp-float-b'}><PhoneShot screen={f.screen} label={f.eyebrow} /></Phone>
              </div>
              <div style={{ flex: 1.05 }}>
                <div className="font-overpass uppercase flex items-center" style={{ color: LIME, fontWeight: 800, fontSize: 12, letterSpacing: '0.2em', marginBottom: 12 }}>
                  <span className="lp-dot" />{f.eyebrow}
                </div>
                <h3 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(25px,6vw,40px)', lineHeight: '100%', marginBottom: 14 }}>{f.title}</h3>
                <p className="font-overpass" style={{ color: '#C9C7D4', fontSize: 'clamp(15px,3.8vw,17px)', lineHeight: 1.55, maxWidth: 460, marginBottom: 18 }}>{f.body}</p>
                <ul className="flex flex-col gap-2.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2.5">
                      <span style={{ width: 20, height: 20, borderRadius: 999, background: 'rgba(161,255,74,0.16)', color: LIME, fontWeight: 900, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</span>
                      <span className="font-overpass" style={{ color: '#D7D5E0', fontSize: 14 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* INLINE CTA */}
      <section style={{ padding: '8px clamp(16px,5vw,40px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'linear-gradient(120deg, rgba(161,255,74,0.12), rgba(68,92,255,0.14))', border: '1px solid rgba(161,255,74,0.22)', borderRadius: 20, padding: '24px 26px' }}>
            <div className="font-overpass uppercase text-center sm:text-left" style={{ fontWeight: 800, fontSize: 'clamp(17px,4.5vw,24px)', lineHeight: '112%' }}>Звучит как твой тренер?</div>
            <Link href="/login" className="lp-cta font-overpass uppercase" style={{ ...ctaStyle, flexShrink: 0 }}>Начать бесплатно</Link>
          </div>
        </Reveal>
      </section>

      {/* WHY US / COMPARISON */}
      <section style={{ padding: 'clamp(48px,9vw,80px) clamp(16px,5vw,40px) 24px', maxWidth: 1040, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="почему мы" title="Сравни с тем, как тренируются обычно" /></Reveal>
        <Reveal>
          <div style={{ overflow: 'hidden', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
              {['', 'Треньки', 'YouTube', 'Тренер'].map((h, i) => (
                <div key={i} className="font-overpass uppercase" style={{ fontSize: 'clamp(9px,2.6vw,12px)', fontWeight: 800, letterSpacing: 0.3, padding: '13px 8px', textAlign: i === 0 ? 'left' : 'center', color: i === 1 ? '#060919' : '#AEABBB', background: i === 1 ? LIME : 'rgba(255,255,255,0.03)' }}>{h}</div>
              ))}
            </div>
            {[['Под тебя лично', '✓', '✗', '✓'], ['Цена', 'Старт 0₽', '0₽', 'Дорого'], ['Виден прогресс', '✓', '✗', '~'], ['Где угодно', '✓', '✓', '✗']].map((row, ri) => (
              <div key={ri} className="grid" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {row.map((cell, ci) => (
                  <div key={ci} className="font-overpass" style={{ fontSize: 'clamp(10px,2.8vw,13px)', padding: '13px 8px', textAlign: ci === 0 ? 'left' : 'center', fontWeight: ci === 0 ? 700 : 800, color: ci === 0 ? '#F9F8FE' : cell === '✓' ? LIME : cell === '✗' ? '#6B6A77' : '#AEABBB', background: ci === 1 ? 'rgba(161,255,74,0.06)' : 'transparent' }}>{cell}</div>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* SHORTS */}
      <section style={{ padding: 'clamp(40px,7vw,64px) clamp(16px,5vw,40px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ background: 'linear-gradient(135deg, rgba(161,255,74,0.10) 0%, rgba(68,92,255,0.18) 100%)', border: '1px solid rgba(161,255,74,0.2)', borderRadius: 24, padding: 'clamp(24px,5vw,36px) clamp(18px,4vw,28px)' }}>
            <div className="lg:flex lg:items-center lg:justify-between lg:gap-8">
              <div style={{ maxWidth: 420 }}>
                <div className="font-overpass uppercase flex items-center" style={{ color: LIME, fontWeight: 800, fontSize: 12, letterSpacing: '0.2em', marginBottom: 12 }}><span className="lp-dot" />разборы и треньки</div>
                <h2 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(24px,6vw,38px)', lineHeight: '100%', marginBottom: 10 }}>Учись у профи</h2>
                <p className="font-overpass" style={{ color: '#C9C7D4', fontSize: 15, lineHeight: 1.5, marginBottom: 18 }}>Сотни коротких видео: техника, советы и разбор игровых моментов — прямо в ленте.</p>
              </div>
              <div className="flex gap-3 overflow-x-auto lg:overflow-visible" style={{ paddingBottom: 4 }}>
                {['shorts_1', 'shorts_2', 'shorts_3', 'shorts_4'].map((s, i) => (
                  <div key={s} className="relative overflow-hidden lp-float" style={{ width: 124, aspectRatio: '9/16', borderRadius: 14, background: '#101530', flexShrink: 0, animationDelay: `${i * 0.4}s` }}>
                    <Image src={`/images/preview_shorts/${s}.png`} alt="Разбор" fill className="object-cover" sizes="124px" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* HOW */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(40px,7vw,64px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="3 шага" title="Как это работает" /></Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 16 }}>
          {[['01', 'Пройди короткий опрос', 'Расскажи о форме и цели — минута времени.'], ['02', 'ИИ соберёт неделю', 'Микроцикл из 5 тренировок под твой уровень.'], ['03', 'Тренируйся и расти', 'Следи, как растёт потенциал, нагрузка адаптируется.']].map(([n, t, b], i) => (
            <Reveal key={n} delay={i * 0.1}>
              <div className="lp-card" style={{ padding: 24, borderRadius: 18, background: 'rgba(16,21,48,0.5)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
                <div className="font-overpass" style={{ color: BLUE, fontWeight: 900, fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{n}</div>
                <h3 className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>{t}</h3>
                <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5 }}>{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FOR WHOM */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(40px,7vw,64px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="кому подойдёт" title="Для кого «Треньки»" /></Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 16 }}>
          {FOR_WHOM.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.08}>
              <div className="lp-card" style={{ padding: 26, borderRadius: 18, background: 'linear-gradient(180deg, rgba(68,92,255,0.12) 0%, rgba(16,21,48,0.5) 100%)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
                <div style={{ fontSize: 30, marginBottom: 12 }}>{x.emoji}</div>
                <h3 className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>{x.t}</h3>
                <p className="font-overpass" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.5 }}>{x.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ROADMAP */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(40px,7vw,64px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="спортсмену и родителю" title="Что уже доступно и что впереди" /></Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 16 }}>
          <Reveal>
            <div className="lp-card" style={{ padding: 26, borderRadius: 18, background: 'linear-gradient(180deg, rgba(161,255,74,0.10) 0%, rgba(16,21,48,0.5) 100%)', border: '1px solid rgba(161,255,74,0.25)', height: '100%' }}>
              <div className="font-overpass uppercase" style={{ color: LIME, fontWeight: 800, fontSize: 12, letterSpacing: '0.16em', marginBottom: 14 }}>✅ Уже доступно</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ROADMAP_NOW.map((x) => (
                  <li key={x} className="font-overpass flex gap-2" style={{ color: '#F9F8FE', fontSize: 14, lineHeight: 1.45 }}>
                    <span style={{ color: LIME, flexShrink: 0 }}>✓</span><span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="lp-card" style={{ padding: 26, borderRadius: 18, background: 'linear-gradient(180deg, rgba(68,92,255,0.12) 0%, rgba(16,21,48,0.5) 100%)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
              <div className="font-overpass uppercase" style={{ color: '#9FB2FF', fontWeight: 800, fontSize: 12, letterSpacing: '0.16em', marginBottom: 14 }}>🚀 Скоро</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {ROADMAP_SOON.map((x) => (
                  <li key={x} className="font-overpass flex gap-2" style={{ color: '#AEABBB', fontSize: 14, lineHeight: 1.45 }}>
                    <span style={{ color: '#9FB2FF', flexShrink: 0 }}>○</span><span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(40px,7vw,64px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="отзывы" title="Что говорят" /></Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))', gap: 16 }}>
          {[['«Наконец-то понятно, что делать каждый день. За месяц бросок стал заметно сильнее.»', 'Игрок, 15 лет'], ['«Сыну собирает программу лучше, чем я бы придумал. И не нужно платить за личного тренера.»', 'Родитель'], ['«Ставлю задания всей команде и вижу, кто как тренируется. Удобно.»', 'Тренер']].map(([quote, who]) => (
            <Reveal key={who}>
              <div className="lp-card" style={{ padding: 24, borderRadius: 18, background: 'rgba(16,21,48,0.5)', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
                <div style={{ color: LIME, fontSize: 32, lineHeight: 1, marginBottom: 6 }}>“</div>
                <p className="font-overpass" style={{ color: '#F9F8FE', fontSize: 15, lineHeight: 1.5, marginBottom: 14 }}>{quote}</p>
                <div className="font-overpass uppercase" style={{ color: '#AEABBB', fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}>{who}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(40px,7vw,64px)', maxWidth: 780, margin: '0 auto' }}>
        <Reveal><SectionHead eyebrow="вопросы" title="Частые вопросы" /></Reveal>
        <div className="flex flex-col gap-3">
          {FAQ.map((f) => <Reveal key={f.q}><FaqItem q={f.q} a={f.a} /></Reveal>)}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ padding: '8px clamp(16px,5vw,40px) clamp(48px,8vw,72px)', maxWidth: 1200, margin: '0 auto' }}>
        <Reveal>
          <div style={{ position: 'relative', overflow: 'hidden', background: 'radial-gradient(circle at 50% 0%, rgba(161,255,74,0.18) 0%, rgba(6,9,25,0) 70%), #0B1030', border: '1px solid rgba(161,255,74,0.25)', borderRadius: 28, padding: 'clamp(40px,8vw,64px) 24px', textAlign: 'center' }}>
            <h2 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 'clamp(28px,8vw,52px)', lineHeight: '100%', marginBottom: 14 }}>
              Собери свою <span className="lp-shimmer">первую неделю</span>
            </h2>
            <p className="font-overpass" style={{ color: '#C9C7D4', fontSize: 16, marginBottom: 26, maxWidth: 440, margin: '0 auto 26px' }}>Это бесплатно и займёт пару минут. ИИ-тренер уже готов.</p>
            <Link href="/login" className="lp-cta font-overpass uppercase" style={ctaStyle}>Начать бесплатно</Link>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '24px clamp(16px,5vw,40px) 28px', maxWidth: 1200, margin: '0 auto' }} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Image src="/icons/icon-app.svg" alt="" width={24} height={24} style={{ borderRadius: 5 }} />
          <span className="font-overpass uppercase" style={{ fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', color: '#AEABBB' }}>треньки</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/legal/terms" className="font-overpass" style={{ color: '#AEABBB', fontSize: 13 }}>Документы</Link>
          <Link href="/login" className="font-overpass" style={{ color: '#AEABBB', fontSize: 13 }}>Войти</Link>
        </div>
        <div className="font-overpass w-full sm:w-auto" style={{ color: '#5B5A68', fontSize: 12 }}>© 2026 Треньки</div>
      </footer>

      {/* Sticky CTA на мобиле */}
      <div className="md:hidden" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px)', background: 'linear-gradient(180deg, rgba(6,9,25,0) 0%, rgba(6,9,25,0.94) 32%)' }}>
        <Link href="/login" className="lp-cta font-overpass uppercase block text-center" style={{ background: LIME, color: '#060919', borderRadius: 999, padding: '15px', fontWeight: 900, fontSize: 15, letterSpacing: '0.04em' }}>Начать бесплатно</Link>
      </div>
      <div className="md:hidden" style={{ height: 84 }} />

      <style jsx global>{`
        @keyframes lpFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes lpFloatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes lpAurora1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(7%,8%) scale(1.18)} }
        @keyframes lpAurora2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-9%,6%) scale(1.22)} }
        @keyframes lpShimmer { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
        @keyframes lpShine { 0%{left:-70%} 55%,100%{left:130%} }
        @keyframes lpMarquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes lpDot { 0%,100%{opacity:.4;transform:scale(.8)} 50%{opacity:1;transform:scale(1.35)} }

        .lp-float { animation: lpFloat 5.5s ease-in-out infinite; }
        .lp-float-b { animation: lpFloatB 6.5s ease-in-out infinite .6s; }
        .lp-aurora { position:absolute; border-radius:50%; filter:blur(70px); pointer-events:none; z-index:0; }
        .lp-a1 { width:46vw; max-width:520px; aspect-ratio:1; background:rgba(161,255,74,0.16); top:-12%; left:-6%; animation:lpAurora1 14s ease-in-out infinite; }
        .lp-a2 { width:50vw; max-width:560px; aspect-ratio:1; background:rgba(68,92,255,0.20); top:6%; right:-12%; animation:lpAurora2 16s ease-in-out infinite; }
        .lp-shimmer { background:linear-gradient(90deg,#A1FF4A,#e6ffc4,#A1FF4A); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent; animation:lpShimmer 3s linear infinite; }
        .lp-dot { display:inline-block; width:7px; height:7px; border-radius:999px; background:#A1FF4A; margin-right:9px; animation:lpDot 1.6s ease-in-out infinite; }
        .lp-marquee { animation:lpMarquee 26s linear infinite; }
        .lp-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .lp-card:hover { transform:translateY(-4px); border-color:rgba(161,255,74,0.3); box-shadow:0 16px 44px rgba(0,0,0,.45); }
        .lp-cta { position:relative; overflow:hidden; transition:transform .15s ease, box-shadow .25s ease; box-shadow:0 8px 30px rgba(161,255,74,0.25); }
        .lp-cta:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(161,255,74,0.45); }
        .lp-cta:active { transform:scale(.96); }
        .lp-cta::after { content:''; position:absolute; top:0; bottom:0; left:-70%; width:45%; background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent); transform:skewX(-20deg); animation:lpShine 3.4s ease-in-out infinite; }
        .lp-ghost { transition:border-color .2s ease, background .2s ease; }
        .lp-ghost:hover { border-color:rgba(161,255,74,0.4); background:rgba(161,255,74,0.06); }

        @media (prefers-reduced-motion: reduce) {
          .lp-float,.lp-float-b,.lp-aurora,.lp-shimmer,.lp-dot,.lp-marquee,.lp-cta::after { animation:none !important; }
        }
      `}</style>
    </div>
  );
}
