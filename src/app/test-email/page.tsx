'use client';

import { useState } from 'react';

export default function TestEmailPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const sendWelcomeEmail = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'welcome',
          to: email,
          data: { name },
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Failed to send email' });
    } finally {
      setLoading(false);
    }
  };

  const sendNewVideoEmail = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new-video',
          to: email,
          data: {
            videoTitle: 'Техника катания задом',
            videoUrl: 'https://trenki.vercel.app/video/123',
          },
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ error: 'Failed to send email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">📧 Тест Email</h1>

        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-white mb-2">Email получателя:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full p-3 rounded bg-[#101530] text-white border border-gray-600"
            />
          </div>

          <div className="mb-6">
            <label className="block text-white mb-2">Имя:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Александр"
              className="w-full p-3 rounded bg-[#101530] text-white border border-gray-600"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={sendWelcomeEmail}
              disabled={loading || !email}
              className="flex-1 bg-[#A1FF4A] text-black font-bold py-3 px-6 rounded hover:bg-[#8FE030] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Отправка...' : 'Отправить приветствие'}
            </button>

            <button
              onClick={sendNewVideoEmail}
              disabled={loading || !email}
              className="flex-1 bg-blue-500 text-white font-bold py-3 px-6 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Отправка...' : 'Отправить "Новое видео"'}
            </button>
          </div>
        </div>

        {result && (
          <div className={`p-6 rounded-lg ${result.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <h2 className="text-xl font-bold text-white mb-2">
              {result.success ? '✅ Успешно!' : '❌ Ошибка'}
            </h2>
            <pre className="text-white text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-8 bg-[#1a1f3a] rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📝 Инструкция:</h2>
          <ol className="text-gray-300 space-y-2">
            <li>1. Введи свой email</li>
            <li>2. Введи имя</li>
            <li>3. Нажми кнопку для отправки письма</li>
            <li>4. Проверь почту! 📬</li>
          </ol>
          
          <div className="mt-4 p-4 bg-yellow-500/20 rounded">
            <p className="text-yellow-300 text-sm">
              ⚠️ Важно: Пока используется тестовый домен <code>onboarding@resend.dev</code>.
              Позже нужно будет добавить свой домен в Resend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
