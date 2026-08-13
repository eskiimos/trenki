// Скелетон сегмента /admin: layout ходит в БД (hasAdminAccessRSC), и без этого
// файла пользователь видел пустой экран. Разметка повторяет каркас дашборда
// (шапка + KPI + секции), чтобы при появлении данных не было прыжка вёрстки.
// Плоский JSX без клиентских импортов — лишний JS в бандл не тянем.

const CARD = {
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  border: '1px solid var(--border-hairline)',
} as const;

export default function AdminLoading() {
  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ background: 'var(--color-night)', color: 'var(--color-ink)' }}
      aria-busy="true"
      aria-live="polite"
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <span className="sr-only">Загрузка админки…</span>

        {/* Шапка */}
        <div className="animate-pulse" style={{ marginBottom: 24 }}>
          <div style={{ ...CARD, height: 16, width: 120, marginBottom: 12 }} />
          <div style={{ ...CARD, height: 28, width: 240 }} />
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 mb-8">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ ...CARD, height: 96 }} />
          ))}
        </div>

        {/* Секции */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ ...CARD, height: 76 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
