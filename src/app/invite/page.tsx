'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function InvitePage() {
  const router = useRouter();
  const [code, setCode] = useState(['', '', '']);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Проверяем, есть ли уже валидный код в cookies/localStorage
  useEffect(() => {
    const savedCode = localStorage.getItem('validInviteCode');
    if (savedCode) {
      // Если код уже есть, перенаправляем на логин
      router.push('/login');
    }
  }, [router]);

  // Обработка ввода кода
  const handleCodeInput = (index: number, value: string) => {
    // Разрешаем только буквы и цифры
    const sanitized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (sanitized.length <= 3) {
      const newCode = [...code];
      newCode[index] = sanitized;
      setCode(newCode);
      setError(null);

      // Автоматический фокус на следующее поле
      if (sanitized.length === 3 && index < 2) {
        const nextInput = document.getElementById(`code-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  // Обработка вставки кода из буфера обмена
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    // Разбираем код формата XXX-XXX или XXXXXX
    let parts: string[];
    if (pastedText.includes('-')) {
      parts = pastedText.split('-').filter(p => p.length > 0);
    } else if (pastedText.length === 6) {
      parts = [pastedText.slice(0, 3), pastedText.slice(3, 6)];
    } else {
      return;
    }

    if (parts.length === 2 && parts[0].length <= 3 && parts[1].length <= 3) {
      setCode([parts[0], '-', parts[1]]);
    }
  };

  // Валидация кода
  const validateCode = async () => {
    const fullCode = `${code[0]}-${code[2]}`;
    
    if (code[0].length !== 3 || code[2].length !== 3) {
      setError('Введите код полностью');
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/invite/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: fullCode }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        // Сохраняем валидный код в localStorage
        localStorage.setItem('validInviteCode', fullCode);
        
        // Сохраняем в cookie для backend
        document.cookie = `inviteCode=${fullCode}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 дней
        
        // Перенаправляем на страницу логина
        router.push('/login');
      } else {
        setError(data.error || 'Неверный инвайт-код');
      }
    } catch (err) {
      console.error('Error validating code:', err);
      setError('Ошибка проверки кода. Попробуйте ещё раз.');
    } finally {
      setIsValidating(false);
    }
  };

  // Обработка нажатия Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code[0].length === 3 && code[2].length === 3) {
      validateCode();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
            <span className="text-4xl">🏒</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">
            TRENKI
          </h1>
          <p className="text-blue-100 text-lg">
            Закрытое бета-тестирование
          </p>
        </div>

        {/* Карточка с формой */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Введите инвайт-код
            </h2>
            <p className="text-gray-600">
              У вас есть код? Введите его для доступа к приложению
            </p>
          </div>

          {/* Поля ввода кода */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <input
              id="code-0"
              type="text"
              value={code[0]}
              onChange={(e) => handleCodeInput(0, e.target.value)}
              onPaste={handlePaste}
              onKeyPress={handleKeyPress}
              className="w-20 h-20 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none uppercase"
              maxLength={3}
              placeholder="XXX"
              autoFocus
            />
            <span className="text-3xl font-bold text-gray-400">-</span>
            <input
              id="code-1"
              type="text"
              value={code[2]}
              onChange={(e) => handleCodeInput(2, e.target.value)}
              onPaste={handlePaste}
              onKeyPress={handleKeyPress}
              className="w-20 h-20 text-center text-3xl font-bold border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none uppercase"
              maxLength={3}
              placeholder="XXX"
            />
          </div>

          {/* Сообщение об ошибке */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          {/* Кнопка */}
          <button
            onClick={validateCode}
            disabled={isValidating || code[0].length !== 3 || code[2].length !== 3}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isValidating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Проверка...
              </span>
            ) : (
              'Продолжить'
            )}
          </button>

          {/* Информация */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Нет кода? Свяжитесь с администратором для получения доступа
            </p>
          </div>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-6 text-center text-white text-sm opacity-80">
          <p>🎯 Вы участвуете в закрытом бета-тестировании</p>
          <p className="mt-1">Ваше мнение поможет сделать приложение лучше!</p>
        </div>
      </div>
    </div>
  );
}
