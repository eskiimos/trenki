'use client';

import { useEffect, useState } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  inputStyle,
} from '@/components/admin/ui';
import { AlarmClock, BellRing, CalendarClock, Check, AlertTriangle } from 'lucide-react';

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
      setMsg({ type: 'ok', text: 'Сохранено' });
    } catch {
      setMsg({ type: 'err', text: 'Сетевая ошибка' });
    } finally {
      setSaving(false);
    }
  };

  const hintStyle: React.CSSProperties = {
    color: 'var(--color-muted)',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 1.4,
  };
  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--color-muted)',
    marginBottom: 8,
  };

  return (
    <AdminPage width="narrow">
      <PageHeader title="Время уведомлений" icon={AlarmClock} backHref="/admin" />

      <p style={{ color: 'var(--color-muted)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px' }}>
        Когда приложение шлёт пуши. Время ежедневного напоминания — <b>локальное для каждого
        пользователя</b> (по его часовому поясу). Меняется на лету, без перезапуска.
      </p>

      {loading ? (
        <div className="flex flex-col" style={{ gap: 24 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="animate-pulse"
              style={{
                height: 160,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 24 }}>
          {/* Ежедневное напоминание */}
          <AdminCard>
            <SectionTitle icon={BellRing}>Ежедневное напоминание о тренировке</SectionTitle>
            <input
              type="time"
              min="06:00"
              max="22:00"
              value={dailyTime}
              onChange={(e) => setDailyTime(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200, colorScheme: 'dark' }}
            />
            <div style={hintStyle}>
              Каждый игрок получит пуш в это время по своему часовому поясу. Диапазон 06:00–22:00, по
              умолчанию 10:00.
            </div>
          </AdminCard>

          {/* Предтренировочные */}
          <AdminCard>
            <SectionTitle icon={CalendarClock}>
              Напоминания перед запланированной тренировкой
            </SectionTitle>
            <div className="flex gap-4 flex-wrap">
              <div>
                <label style={fieldLabelStyle} htmlFor="reminder-early">Раннее (за, мин)</label>
                <input
                  id="reminder-early"
                  type="number"
                  min={1}
                  max={1440}
                  value={early}
                  onChange={(e) => setEarly(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 120, colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label style={fieldLabelStyle} htmlFor="reminder-late">Позднее (за, мин)</label>
                <input
                  id="reminder-late"
                  type="number"
                  min={1}
                  max={1440}
                  value={late}
                  onChange={(e) => setLate(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 120, colorScheme: 'dark' }}
                />
              </div>
            </div>
            <div style={hintStyle}>
              Два пуша до старта занятия в календаре. По умолчанию за 30 и за 10 минут. Раннее должно
              быть минимум на 10 минут больше позднего.
            </div>
          </AdminCard>

          {msg && (
            <AdminCard tone={msg.type === 'ok' ? 'accent' : 'danger'}>
              <div className="flex items-center gap-3" role="status" aria-live="polite">
                {msg.type === 'ok' ? (
                  <Check size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} aria-hidden />
                ) : (
                  <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden />
                )}
                <span style={{ fontSize: 14, fontWeight: 700 }}>{msg.text}</span>
              </div>
            </AdminCard>
          )}

          <div>
            <AdminButton type="button" onClick={save} disabled={saving} icon={Check}>
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </AdminButton>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
