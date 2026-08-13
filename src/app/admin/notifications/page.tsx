'use client';

import { useState, useEffect } from 'react';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  EmptyState,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import {
  Send,
  BellRing,
  History,
  Link2,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  url: string | null;
  sentCount: number;
  createdAt: string;
  sentBy: string | null;
}

interface NotificationHistory {
  notifications: Notification[];
  subscriptionsCount: number;
}

export default function NotificationsAdminPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('/icons/icon-192.png');
  const [url, setUrl] = useState('/');
  const [loading, setLoading] = useState(false);
  // Тип сообщения хранится отдельно от текста: раньше цвет плашки вычислялся
  // поиском эмодзи-галочки в самой строке — UI-логика была завязана на эмодзи.
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [history, setHistory] = useState<NotificationHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Загрузка истории уведомлений
  const loadHistory = async () => {
    try {
      const response = await fetch('/api/push/send');
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Ошибка при загрузке истории:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSendNotification = async () => {
    if (!title || !body) {
      setMessage({ type: 'err', text: 'Заполните заголовок и текст уведомления' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          body,
          icon: icon || '/icons/icon-192.png',
          url: url || '/',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'ok', text: data.message });
        setTitle('');
        setBody('');
        setUrl('/');
        loadHistory(); // Обновляем историю
      } else {
        setMessage({ type: 'err', text: `Ошибка: ${data.error}` });
      }
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      setMessage({ type: 'err', text: 'Ошибка при отправке уведомления' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const disabled = loading || !title || !body;

  return (
    <AdminPage width="narrow">
      <PageHeader title="Push-уведомления" icon={Send} backHref="/admin" />

      {/* Статистика */}
      {history && (
        <AdminCard style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-3">
            <BellRing size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} aria-hidden />
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>
              Активных подписок:{' '}
              <strong style={{ color: 'var(--color-ink)' }}>{history.subscriptionsCount}</strong>
            </p>
          </div>
        </AdminCard>
      )}

      {/* Форма создания уведомления */}
      <AdminCard style={{ marginBottom: 16 }}>
        <SectionTitle icon={Send}>Создать уведомление</SectionTitle>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="push-title">Заголовок *</label>
          <input
            id="push-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Новая тренировка!"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="push-body">Текст уведомления *</label>
          <textarea
            id="push-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Например: Доступна новая тренировка по хоккею"
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="push-icon">URL иконки</label>
          <input
            id="push-icon"
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="/icons/icon-192.png"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle} htmlFor="push-url">URL для перехода</label>
          <input
            id="push-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            style={inputStyle}
          />
        </div>

        <AdminButton
          onClick={handleSendNotification}
          disabled={disabled}
          icon={Send}
          style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Отправка…' : 'Отправить всем'}
        </AdminButton>

        {message && (
          <div style={{ marginTop: 16 }}>
            <AdminCard tone={message.type === 'ok' ? 'accent' : 'danger'}>
              <div className="flex items-center gap-3" role="status" aria-live="polite">
                {message.type === 'ok' ? (
                  <Check size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} aria-hidden />
                ) : (
                  <AlertTriangle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0 }} aria-hidden />
                )}
                <span style={{ fontSize: 14 }}>{message.text}</span>
              </div>
            </AdminCard>
          </div>
        )}
      </AdminCard>

      {/* История уведомлений */}
      <AdminCard>
        <SectionTitle icon={History}>История отправленных уведомлений</SectionTitle>

        {historyLoading ? (
          <div className="flex flex-col" style={{ gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  height: 96,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-night)',
                }}
              />
            ))}
          </div>
        ) : !history || history.notifications.length === 0 ? (
          <EmptyState
            icon={History}
            title="Пока не отправлено ни одного уведомления"
            hint="Заполните форму выше и отправьте первый пуш"
          />
        ) : (
          <div className="flex flex-col" style={{ gap: 12 }}>
            {history.notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: 12,
                  background: 'var(--color-night)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-hairline)',
                }}
              >
                <div className="flex justify-between gap-3" style={{ marginBottom: 4 }}>
                  <strong style={{ fontSize: 14 }}>{notification.title}</strong>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', flexShrink: 0 }}>
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 14, color: 'var(--color-muted)' }}>
                  {notification.body}
                </p>
                <div
                  className="flex flex-wrap items-center"
                  style={{ gap: 16, fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}
                >
                  <span className="inline-flex items-center gap-1">
                    <Send size={16} aria-hidden />
                    Отправлено: {notification.sentCount}
                  </span>
                  {notification.url && notification.url !== '/' && (
                    <span className="inline-flex items-center gap-1 min-w-0">
                      <Link2 size={16} className="shrink-0" aria-hidden />
                      <span className="truncate">{notification.url}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
