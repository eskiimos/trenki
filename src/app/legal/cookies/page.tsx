import Link from 'next/link';

export const metadata = {
  title: 'Политика использования файлов cookie — Треньки',
};

export default function CookiesPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8" style={{ paddingBottom: '40px' }}>
      <div className="mb-8 flex items-center gap-3">
        <Link href="/" className="shrink-0">
          <img src="/icons/icon-action-back.svg" alt="Назад" width={24} height={24} />
        </Link>
        <h1 style={{
          fontFamily: 'Overpass',
          fontWeight: 700,
          fontSize: '12px',
          lineHeight: '120%',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          color: '#F9F8FE',
        }}>
          Политика использования файлов cookie
        </h1>
      </div>

      <div style={{ fontFamily: 'Overpass, sans-serif', color: '#F9F8FE', lineHeight: '1.7' }}>
        <p style={{ color: '#9B99AA', fontSize: '13px', marginBottom: '24px' }}>
          Дата последнего обновления: «7» мая 2026 г.
        </p>

        <Section title="1. Что такое файлы cookie?">
          <P>Файлы cookie – это небольшие текстовые файлы, которые сохраняются на вашем устройстве (компьютере, смартфоне, планшете) при посещении нашего Сервиса. Они помогают Сервису «запоминать» информацию о вашем посещении, например, предпочтительный язык, что делает использование сайта более удобным и персонализированным.</P>
        </Section>

        <Section title="2. Как мы используем файлы cookie?">
          <P>Файлы cookie используются нами в следующих целях:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Для обеспечения технической работоспособности Сервиса (обязательные cookie).</li>
            <li>Для анализа использования Сервиса (аналитические cookie). Мы изучаем, как вы взаимодействуете с платформой, чтобы улучшать её функциональность, интерфейс и контент.</li>
            <li>Для персонализации вашего опыта. Cookie помогают показывать наиболее релевантный для вас контент и рекомендации.</li>
          </ul>
        </Section>

        <Section title="3. Типы используемых нами файлов cookie">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CookieType name="Обязательные (Essential)" desc="Необходимы для корректной работы Сервиса. Без них некоторые функции могут быть недоступны. Не могут быть отключены." />
            <CookieType name="Аналитические (Analytics)" desc="Позволяют нам анализировать, как пользователи взаимодействуют с Сервисом, и улучшать его." />
            <CookieType name="Функциональные (Functional)" desc="Запоминают ваши предпочтения (например, язык интерфейса) для персонализации опыта." />
          </div>
        </Section>

        <Section title="4. Управление файлами cookie">
          <P>Вы можете контролировать и управлять использованием файлов cookie следующими способами:</P>
          <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>Через настройки согласия на нашем Сервисе. При первом посещении вам будет показан баннер с запросом согласия. Вы можете изменить выбор в любое время через страницу конфиденциальности в футере Сервиса.</li>
            <li>Через настройки вашего браузера. Вы можете настроить браузер на блокировку всех cookie или предупреждение об их отправке. Обратите внимание: отключение обязательных cookie может нарушить работу Сервиса.</li>
          </ul>
        </Section>

        <Section title="5. Сторонние cookie и ссылки">
          <P>Наш Сервис может содержать ссылки на сайты третьих лиц. Настоящая Политика cookie распространяется только на наш Сервис. Если вы переходите по ссылке на другой сайт — ознакомьтесь с его собственной политикой в отношении cookie.</P>
        </Section>

        <Section title="6. Обновления Политики cookie">
          <P>Мы можем обновлять эту Политику при изменении законодательства, появлении новых функций Сервиса или новых сервисов аналитики. Актуальная версия всегда доступна на этой странице. При существенных изменениях мы уведомим вас через Сервис или по электронной почте.</P>
        </Section>

        <Section title="7. Контактная информация">
          <P>Если у вас есть вопросы относительно использования файлов cookie:</P>
          <P>Email: <a href="mailto:trenki.app@yandex.ru" style={{ color: '#A1FF4A' }}>trenki.app@yandex.ru</a></P>
        </Section>

        <div style={{ marginTop: '32px', padding: '16px', borderRadius: '8px', background: 'rgba(161, 255, 74, 0.08)', border: '1px solid rgba(161, 255, 74, 0.2)' }}>
          <P>Данная политика является неотъемлемой частью <Link href="/legal/privacy" style={{ color: '#A1FF4A', textDecoration: 'underline' }}>Политики конфиденциальности</Link> ООО «Треньки».</P>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{
        fontFamily: 'Overpass',
        fontWeight: 700,
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: '#A1FF4A',
        marginBottom: '12px',
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
        {children}
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0 }}>{children}</p>;
}

function CookieType({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(174, 171, 187, 0.1)' }}>
      <div style={{ fontWeight: 700, fontSize: '13px', color: '#F9F8FE', marginBottom: '4px' }}>{name}</div>
      <div style={{ fontSize: '13px', color: '#9B99AA' }}>{desc}</div>
    </div>
  );
}
