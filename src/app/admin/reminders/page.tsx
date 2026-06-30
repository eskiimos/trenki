'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Админка: время уведомлений (читается крон-роутами из app_settings).
export default function RemindersAdminPage() {
  const [dailyTime, setDailyTime] = useState('10:00');
  const [early, setEarly] = useState('30');
  const [late, setLate] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/reminders');
        if (res.ok) {
          const d = await res.json();
          setDailyTime(d.dailyTime ?? '10:00');
          setEarly(String(d.preworkoutEarlyMin ?? 30));
          setLate(String(d.preworkoutLateMin ?? 10));
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/reminders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dailyTime,
          preworkoutEarlyMin: Number(early),
          preworkoutLateMin: Number(late),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ type: 'err', text: d?.error || 'Ошибка сохранения' });
        return;
      }
      setDailyTime(d.dailyTime);
      setEarly(String(d.preworkoutEarlyMin));
      setLate(String(d.preworkoutLateMin));
      setMsg({ type: 'ok', text: 'Сохранено ✓' });
    } catch {
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    color: '#F9F8FE',
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 6,
  };
  const hintStyle: React.CSSProperties = { color: '#AEABBB', fontSize: 12, marginTop: 6, lineHeight: 1.4 };
  const inputStyle: React.CSSProperties = {
    background: '#060919',
    border: '1px solid #26252F',
    borderRadius: 10,
    padding: '12px 14px',
    color: '#F9F8FE',
    fontSize: 16,
    outline: 'none',
    colorScheme: 'dark',
    width: '100%',
    maxWidth: 200,
  };

  return (
    <div style={{ background: '#101530', minHeight: '100vh', color: '#F9F8FE' }}>
      <div
        className="max-w-2xl mx-auto px-5 pb-24"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}
      >
        <Link href="/admin" style={{ color: '#AEABBB', fontSize: 13 }}>
          ← В админку
        </Link>
        <h1 className="font-overpass uppercase" style={{ fontWeight: 900, fontSize: 24, marginTop: 8 }}>
          ⏰ Время уведомлений
        </h1>
        <p style={{ color: '#AEABBB', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          Когда приложение шлёт пуши. Время ежедневного напоминания — <b>локальное для каждого
          пользователя</b> (по его часовому поясу). Меняется на лету, без перезапуска.
        </p>

        {loading ? (
          <div style={{ color: '#AEABBB', fontSize: 14, marginTop: 30 }}>Загружаем…</div>
        ) : (
          <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 26 }}>
            {/* Ежедневное напоминание */}
            <section
              style={{
                background: '#0B1030',
                border: '1px solid #26252F',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={labelStyle}>🔔 Ежедневное напоминание о тренировке</div>
              <input
                type="time"
                min="06:00"
                max="22:00"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                style={inputStyle}
              />
              <div style={hintStyle}>
                Каждый игрок получит пуш в это время по своему часовому поясу. Диапазон 06:00–22:00, по
                умолчанию 10:00.
              </div>
            </section>

            {/* Предтренировочные */}
            <section
              style={{
                background: '#0B1030',
                border: '1px solid #26252F',
                borderRadius: 16,
                padding: 18,
              }}
            >
              <div style={labelStyle}>🏒 Напоминания перед запланированной тренировкой</div>
              <div className="flex gap-4 flex-wrap" style={{ marginTop: 4 }}>
                <div>
                  <div style={{ color: '#AEABBB', fontSize: 12, marginBottom: 4 }}>Раннее (за, мин)</div>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={early}
                    onChange={(e) => setEarly(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                </div>
                <div>
                  <div style={{ color: '#AEABBB', fontSize: 12, marginBottom: 4 }}>Позднее (за, мин)</div>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={late}
                    onChange={(e) => setLate(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 120 }}
                  />
                </div>
              </div>
              <div style={hintStyle}>
                Два пуша до старта занятия в календаре. По умолчанию за 30 и за 10 минут. Раннее должно
                быть минимум на 10 минут больше позднего.
              </div>
            </section>

            {msg && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: msg.type === 'ok' ? '#A1FF4A' : '#FF6B6B',
                }}
              >
                {msg.text}
              </div>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="font-overpass uppercase transition-transform active:scale-95"
              style={{
                background: '#A1FF4A',
                color: '#060919',
                border: 'none',
                borderRadius: 999,
                padding: '14px 24px',
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: '0.03em',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                alignSelf: 'flex-start',
              }}
            >
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
