'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<NotificationHistory | null>(null);

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
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSendNotification = async () => {
    if (!title || !body) {
      setMessage('❌ Заполните заголовок и текст уведомления');
      return;
    }

    setLoading(true);
    setMessage('');

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
        setMessage(`✅ ${data.message}`);
        setTitle('');
        setBody('');
        setUrl('/');
        loadHistory(); // Обновляем историю
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      setMessage('❌ Ошибка при отправке уведомления');
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

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Overpass, sans-serif',
    }}>
      {/* Header с кнопкой назад */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <Link href="/admin">
          <button
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#1a1a1a',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#2a2a2a'}
            onMouseOut={(e) => e.currentTarget.style.background = '#1a1a1a'}
          >
            <Image 
              src="/icons/arrow.svg" 
              alt="Назад" 
              width={20} 
              height={20}
              style={{ transform: 'rotate(180deg)' }}
            />
          </button>
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
          📬 Push-уведомления
        </h1>
      </div>

      {/* Статистика */}
      {history && (
        <div style={{
          background: '#1a1a1a',
          padding: '15px',
          borderRadius: '12px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>
            Активных подписок: <strong style={{ color: '#fff' }}>{history.subscriptionsCount}</strong>
          </p>
        </div>
      )}

      {/* Форма создания уведомления */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>
          Создать уведомление
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            Заголовок *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Новая тренировка!"
            style={{
              width: '100%',
              padding: '10px',
              background: '#2a2a2a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            Текст уведомления *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Например: Доступна новая тренировка по хоккею"
            rows={3}
            style={{
              width: '100%',
              padding: '10px',
              background: '#2a2a2a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            URL иконки
          </label>
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="/icons/icon-192.png"
            style={{
              width: '100%',
              padding: '10px',
              background: '#2a2a2a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
            URL для перехода
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            style={{
              width: '100%',
              padding: '10px',
              background: '#2a2a2a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <button
          onClick={handleSendNotification}
          disabled={loading || !title || !body}
          style={{
            width: '100%',
            padding: '12px',
            background: loading || !title || !body ? '#333' : '#007AFF',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading || !title || !body ? 'not-allowed' : 'pointer',
            opacity: loading || !title || !body ? 0.5 : 1,
          }}
        >
          {loading ? 'Отправка...' : 'Отправить всем'}
        </button>

        {message && (
          <div style={{
            marginTop: '15px',
            padding: '10px',
            background: message.includes('✅') ? '#1a4d1a' : '#4d1a1a',
            borderRadius: '8px',
            fontSize: '14px',
          }}>
            {message}
          </div>
        )}
      </div>

      {/* История уведомлений */}
      {history && history.notifications.length > 0 && (
        <div style={{
          background: '#1a1a1a',
          padding: '20px',
          borderRadius: '12px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>
            История отправленных уведомлений
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.notifications.map((notification) => (
              <div
                key={notification.id}
                style={{
                  padding: '12px',
                  background: '#2a2a2a',
                  borderRadius: '8px',
                  border: '1px solid #333',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <strong style={{ fontSize: '14px' }}>{notification.title}</strong>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                <p style={{ margin: '5px 0', fontSize: '13px', color: '#ccc' }}>
                  {notification.body}
                </p>
                <div style={{ display: 'flex', gap: '15px', fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
                  <span>📨 Отправлено: {notification.sentCount}</span>
                  {notification.url && notification.url !== '/' && (
                    <span>🔗 {notification.url}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
