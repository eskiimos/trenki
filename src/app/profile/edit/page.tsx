'use client';

import { POSITION_LABEL, POSITION_OPTIONS } from '@/lib/positions';
import Image from 'next/image';
import DateWheelPicker from '@/components/DateWheelPicker';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../../hooks/useTelegram';
import { ProfileEditSkeleton } from '../../../components/Skeleton';
import BottomNavigation from '@/components/BottomNavigation';
import { apiCache } from '@/lib/cache';
import ImageCropper from '@/components/ImageCropper';
import { Check } from 'lucide-react';
import {
  sanitizeName,
  isValidName,
  sanitizeNumberInput,
  NAME_MAX_FIRST,
  NAME_MAX_LAST,
} from '@/lib/profile-validation';

const ProfileEditPage = () => {
  const { user } = useTelegram();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    number: '',
    birthDate: '',
    gender: '',
    height: '',
    weight: '',
    avatarUrl: '',
    clubLogoUrl: ''
  });

  // Email-верификация
  const [emailInput, setEmailInput] = useState('');
  const [currentEmail, setCurrentEmail] = useState(''); // email из БД
  const [emailStep, setEmailStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [emailCode, setEmailCode] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailCountdown, setEmailCountdown] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchUserProfile = async () => {
      if (!user?.id || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/profile');
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        
        if (!cancelled) {
          setUserProfile(data.user);
          
          // Заполняем форму данными.
          // Имя/фамилию/номер чистим маской уже на загрузке — иначе legacy-значения
          // (например, с пробелами из Telegram) заблокировали бы сохранение профиля.
          setFormData({
            firstName: sanitizeName(data.user?.firstName || user.first_name || '', NAME_MAX_FIRST),
            lastName: sanitizeName(data.user?.lastName || user.last_name || '', NAME_MAX_LAST),
            position: data.user?.profile?.position || '',
            number: sanitizeNumberInput(data.user?.profile?.number?.toString() || ''),
            birthDate: data.user?.profile?.birthDate ? new Date(data.user.profile.birthDate).toISOString().split('T')[0] : '',
            gender: data.user?.profile?.gender || '',
            height: data.user?.profile?.height?.toString() || '',
            weight: data.user?.profile?.weight?.toString() || '',
            avatarUrl: data.user?.profile?.avatarUrl || '',
            clubLogoUrl: data.user?.profile?.clubLogoUrl || '',
          });

          // Заполняем email если уже есть
          if (data.user?.email && !data.user.email.includes('@t.me')) {
            setCurrentEmail(data.user.email);
            setEmailInput(data.user.email);
            setEmailStep('verified');
          }
          
          // Устанавливаем превью только для аватара, если есть URL
          if (data.user?.profile?.avatarUrl) {
            setAvatarPreview(data.user.profile.avatarUrl);
          }
          if (data.user?.profile?.clubLogoUrl) {
            setLogoPreview(data.user.profile.clubLogoUrl);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки профиля:', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Загружаем данные только если их еще нет
    if (user?.id && !userProfile) {
      fetchUserProfile();
    } else if (user?.id && userProfile) {
      setIsLoading(false);
    }

    // Cleanup функция
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Зависимость только от ID пользователя

  // обратный отсчёт для повторной отправки
  useEffect(() => {
    if (emailCountdown <= 0) return;
    const t = setTimeout(() => setEmailCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [emailCountdown]);

  const handleSendEmailCode = async () => {
    setEmailError(null);
    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error || 'Ошибка отправки'); return; }
      setEmailStep('sent');
      setEmailCountdown(60);
    } catch {
      setEmailError('Сетевая ошибка');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    setEmailError(null);
    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error || 'Неверный код'); return; }
      setEmailStep('verified');
      setCurrentEmail(emailInput);
      setEmailCode('');
    } catch {
      setEmailError('Сетевая ошибка');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Показываем превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Загружаем на сервер
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        setFormData(prev => ({ ...prev, avatarUrl: data.url }));
        console.log('Avatar uploaded:', data.url);
      } else {
        throw new Error(data.error || 'Ошибка загрузки');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Ошибка при загрузке фото. Попробуйте еще раз.');
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Сбрасываем input чтобы можно было выбрать тот же файл повторно
    e.target.value = '';

    const reader = new FileReader();
    reader.onloadend = () => {
      // Открываем кроппер вместо прямой загрузки
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropDone = async (croppedBlob: Blob) => {
    setCropImageSrc(null);
    const objectUrl = URL.createObjectURL(croppedBlob);
    setLogoPreview(objectUrl);

    setIsUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', croppedBlob, 'logo.jpg');

      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: fd,
      });

      const data = await response.json();

      if (response.ok && data.url) {
        setFormData(prev => ({ ...prev, clubLogoUrl: data.url }));
        console.log('Logo uploaded:', data.url);
      } else {
        throw new Error(data.error || 'Ошибка загрузки');
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Ошибка при загрузке логотипа. Попробуйте еще раз.');
      setLogoPreview(null);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Более надежное получение telegramId для продакшена
      let telegramId = user?.id?.toString();
      
      // Fallback методы для получения telegramId на продакшене
      if (!telegramId) {
        telegramId = user?.username;
      }
      
      // Попробуем получить данные из Telegram WebApp напрямую
      if (!telegramId && typeof window !== 'undefined' && window.Telegram?.WebApp) {
        const webAppUser = window.Telegram.WebApp.initDataUnsafe?.user;
        telegramId = webAppUser?.id?.toString() || webAppUser?.username;
      }
      
      // Последний fallback для тестирования
      if (!telegramId) {
        telegramId = 'testuser';
      }
      
      console.log('=== PROFILE SAVE DEBUG ===');
      console.log('User:', user);
      console.log('Final telegramId:', telegramId);
      console.log('Form data:', formData);
      console.log('Environment:', process.env.NODE_ENV);
      console.log('Window Telegram:', typeof window !== 'undefined' ? window.Telegram : 'not available');
      
      const requestData = {
        telegramId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: user?.username,
        email: emailStep === 'verified' ? currentEmail : undefined,
        profile: {
          position: formData.position || null,
          number: formData.number ? parseInt(formData.number, 10) : null,
          birthDate: formData.birthDate ? new Date(formData.birthDate).toISOString() : null,
          gender: formData.gender || null,
          height: formData.height ? parseInt(formData.height) : null,
          weight: formData.weight ? parseInt(formData.weight) : null,
          avatarUrl: formData.avatarUrl || null,
          clubLogoUrl: formData.clubLogoUrl || null,
        },
      };
      
      console.log('Request data:', JSON.stringify(requestData, null, 2));
      
      // Проверим доступность API перед основным запросом  
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      console.log('Base URL:', baseUrl);
      console.log('API URL:', `${baseUrl}/api/profile`);
      
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let responseData;
      try {
        responseData = await response.json();
        console.log('Response data:', responseData);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error('Сервер вернул невалидный ответ');
      }

      if (response.ok) {
        console.log('Profile saved successfully, redirecting to profile page');
        // Сбрасываем кэш чтобы header на главной обновил данные
        const savedTelegramId = user?.id?.toString();
        if (savedTelegramId) apiCache.delete(`user-status-${savedTelegramId}`);
        router.push('/profile');
      } else {
        console.error('Server error:', responseData);
        throw new Error(responseData.error || `Ошибка сервера: ${response.status}`);
      }
    } catch (error: unknown) {
      console.error('=== PROFILE SAVE ERROR ===');
      
      const err = error as { name?: string; message?: string };
      
      console.error('Error type:', err?.name || 'Unknown');
      console.error('Error message:', err?.message || 'No message');
      console.error('Full error:', error);
      
      let errorMessage = 'Ошибка при сохранении профиля. Попробуйте еще раз.';
      
      if (err?.message?.includes('Failed to fetch')) {
        errorMessage = 'Проблема с подключением. Проверьте интернет соединение.';
      } else if (err?.message?.includes('Сервер вернул невалидный ответ')) {
        errorMessage = 'Сервер недоступен. Попробуйте позже.';
      } else if (err?.message) {
        // Текст ошибки от сервера (валидация имени/номера 400, занятый email 409
        // и т.п.) показываем как есть, чтобы пользователь понял, что исправить.
        errorMessage = err.message;
      }

      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ProfileEditSkeleton />;
  }

  return (
    <div className="bg-surface min-h-screen text-white pb-nav">
      {/* Кроппер логотипа — полноэкранный оверлей */}
      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCropDone={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
      {/* Шапка */}
      <div className="flex items-center justify-between p-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <Link href="/profile" className="inline-block">
          <div className="w-8 h-8 flex items-center justify-center">
            <Image 
              src="/icons/icon-action-back.svg" 
              alt="Назад" 
              width={32} 
              height={32}
            />
          </div>
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isSaving || isUploadingAvatar || isUploadingLogo}
          className="bg-[#445CFF] hover:bg-[#3a4edb] disabled:bg-[#445CFF]/50 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wide"
        >
          {isSaving ? 'Сохранение...' : isUploadingAvatar || isUploadingLogo ? 'Загрузка...' : 'Сохранить'}
        </button>
      </div>

      {/* Основной контент */}
      <div className="px-4 py-6 space-y-6">
        {/* Загрузка фотографии */}
        <div>
          <input
            type="file"
            id="avatar-upload"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={isUploadingAvatar}
          />
          <label
            htmlFor="avatar-upload"
            className="bg-gradient-to-b from-[#2A3B8F] to-[#1a2563] rounded-xl w-40 h-40 mx-auto flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
          >
            {avatarPreview ? (
              <>
                <Image
                  src={avatarPreview}
                  alt="Avatar preview"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="text-[#A1FF4A] text-xs font-bold uppercase tracking-wide">
                    {isUploadingAvatar ? 'Загрузка...' : 'Изменить фото'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 mb-3">
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 32V16M24 16L18 22M24 16L30 22" stroke="#A1FF4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M38 28V38H10V28" stroke="#A1FF4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-[#A1FF4A] text-xs font-bold uppercase tracking-wide">
                  {isUploadingAvatar ? 'Загрузка...' : 'Выбрать фотографию'}
                </div>
              </>
            )}
          </label>
          <p className="text-[#AEABBB] text-xs text-center mt-3 leading-relaxed px-4">
            Загрузи фото без фона в формате PNG хорошего качества или на контрастном однотонном фоне для лучшего результата в формате JPG
          </p>
        </div>

        {/* Имя */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ИМЯ</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', sanitizeName(e.target.value, NAME_MAX_FIRST))}
            maxLength={NAME_MAX_FIRST}
            placeholder="ИМЯ"
            className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
            style={{
              background: '#AEABBB33',
              borderRadius: '32px',
              border: '1px solid transparent',
              height: '44px',
            }}
            onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
            onBlur={(e) => (e.target.style.border = '1px solid transparent')}
          />
          {formData.firstName.length > 0 && !isValidName(formData.firstName, NAME_MAX_FIRST) && (
            <p className="text-[#FF6B6B] text-xs mt-1 ml-1">Только кириллица, минимум 2 буквы</p>
          )}
        </div>

        {/* Фамилия */}
        <div>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', sanitizeName(e.target.value, NAME_MAX_LAST))}
            maxLength={NAME_MAX_LAST}
            placeholder="ФАМИЛИЯ"
            className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
            style={{
              background: '#AEABBB33',
              borderRadius: '32px',
              border: '1px solid transparent',
              height: '44px',
            }}
            onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
            onBlur={(e) => (e.target.style.border = '1px solid transparent')}
          />
          {formData.lastName.length > 0 && !isValidName(formData.lastName, NAME_MAX_LAST) && (
            <p className="text-[#FF6B6B] text-xs mt-1 ml-1">Только кириллица, минимум 2 буквы</p>
          )}
        </div>

        {/* Дата рождения */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ДАТА РОЖДЕНИЯ</label>
          {/* Колёсики гггг-мм-дд вместо системного пикера (правка владельца) */}
          <div style={{ background: '#AEABBB33', borderRadius: 20, padding: '4px 8px' }}>
            <DateWheelPicker
              value={formData.birthDate || null}
              onChange={(next) => handleInputChange('birthDate', next)}
            />
          </div>
        </div>

        {/* Пол */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ПОЛ</label>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => handleInputChange('gender', 'MALE')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                formData.gender === 'MALE'
                  ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                  : 'bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]'
              }`}
            >
              М
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('gender', 'FEMALE')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                formData.gender === 'FEMALE'
                  ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                  : 'bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]'
              }`}
            >
              Ж
            </button>
            <button
              type="button"
              onClick={() => handleInputChange('gender', 'NOT_SPECIFIED')}
              className={`px-6 py-3 rounded-full font-medium text-sm transition-all ${
                formData.gender === 'NOT_SPECIFIED'
                  ? 'bg-[#A1FF4A] text-[#0A0E1A]'
                  : 'bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]'
              }`}
            >
              Не хочу указывать
            </button>
          </div>
        </div>

        {/* Рост */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">РОСТ</label>
          <input
            type="number"
            min="100"
            max="230"
            value={formData.height}
            onChange={(e) => handleInputChange('height', e.target.value)}
            placeholder="СМ"
            className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
            style={{
              background: '#AEABBB33',
              borderRadius: '32px',
              border: '1px solid transparent',
              height: '44px',
            }}
            onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
            onBlur={(e) => (e.target.style.border = '1px solid transparent')}
          />
        </div>

        {/* Вес */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ВЕС</label>
          <input
            type="number"
            min="30"
            max="150"
            value={formData.weight}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            placeholder="КГ"
            className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
            style={{
              background: '#AEABBB33',
              borderRadius: '32px',
              border: '1px solid transparent',
              height: '44px',
            }}
            onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
            onBlur={(e) => (e.target.style.border = '1px solid transparent')}
          />
        </div>

        {/* Загрузка логотипа клуба */}
        <div>
          <input
            type="file"
            id="logo-upload"
            accept="image/*"
            className="hidden"
            onChange={handleLogoUpload}
            disabled={isUploadingLogo}
          />
          <label
            htmlFor="logo-upload"
            className="bg-[#3A3955] rounded-xl w-32 h-32 flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
          >
            {logoPreview ? (
              <>
                <Image
                  src={logoPreview}
                  alt="Logo preview"
                  fill
                  className="object-contain p-4"
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <div className="text-[#A1FF4A] text-xs font-bold uppercase tracking-wide">
                    {isUploadingLogo ? 'Загрузка...' : 'Изменить лого'}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 mb-3">
                  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 32V16M24 16L18 22M24 16L30 22" stroke="#A1FF4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M38 28V38H10V28" stroke="#A1FF4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="text-[#A1FF4A] text-xs font-bold uppercase tracking-wide">
                  {isUploadingLogo ? 'Загрузка...' : 'Загрузить лого клуба'}
                </div>
              </>
            )}
          </label>
          <p className="text-[#AEABBB] text-xs text-center mt-3 leading-relaxed px-4">
            Загрузи логотип в формате png/jpg с максимальным разрешением 2500x2500px
          </p>
        </div>

        {/* Email */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">EMAIL ДЛЯ ВХОДА</label>

          {emailStep === 'verified' ? (
            <div className="flex items-center gap-3">
              <div
                className="flex-1 flex items-center gap-2 px-4 text-white"
                style={{ background: '#AEABBB33', borderRadius: '32px', height: '44px', border: '1px solid #A1FF4A' }}
              >
                <Check size={20} className="text-[#A1FF4A] shrink-0" aria-hidden />
                <span className="truncate text-sm">{currentEmail}</span>
              </div>
              <button
                type="button"
                onClick={() => { setEmailStep('idle'); setEmailInput(currentEmail); setEmailCode(''); setEmailError(null); }}
                className="text-gray-400 hover:text-white text-sm px-3 py-2 rounded-full bg-[#AEABBB33] whitespace-nowrap"
              >
                Изменить
              </button>
            </div>
          ) : emailStep === 'sent' ? (
            <div className="space-y-3">
              <div className="p-3 bg-[#A1FF4A]/10 border border-[#A1FF4A]/30 rounded-xl">
                <p className="text-gray-400 text-xs text-center">
                  Код отправлен на <span className="text-white">{emailInput}</span>
                </p>
              </div>
              <input
                type="text"
                value={emailCode}
                onChange={e => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && emailCode.length === 6 && handleVerifyEmailCode()}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                autoFocus
                className="w-full text-white placeholder-gray-500 px-4 text-center text-xl tracking-[0.4em] font-bold focus:outline-none"
                style={{ background: '#AEABBB33', borderRadius: '32px', border: '1px solid #A1FF4A', height: '44px' }}
              />
              {emailError && <p className="text-red-400 text-xs text-center">{emailError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVerifyEmailCode}
                  disabled={emailLoading || emailCode.length < 6}
                  className="flex-1 py-2.5 rounded-full font-bold text-sm transition-all"
                  style={{ background: emailCode.length === 6 ? '#A1FF4A' : '#AEABBB66', color: emailCode.length === 6 ? '#060919' : '#AEABBB' }}
                >
                  {emailLoading ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEmailStep('idle'); setEmailCode(''); setEmailError(null); }}
                  className="px-4 py-2.5 rounded-full text-sm text-gray-400 bg-[#AEABBB33]"
                >
                  Отмена
                </button>
              </div>
              <div className="text-center">
                {emailCountdown > 0 ? (
                  <span className="text-gray-500 text-xs">Повторить через {emailCountdown}с</span>
                ) : (
                  <button type="button" onClick={handleSendEmailCode} disabled={emailLoading} className="text-[#A1FF4A] text-xs hover:underline">
                    Отправить снова
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); setEmailError(null); }}
                  onKeyDown={e => e.key === 'Enter' && emailInput && handleSendEmailCode()}
                  placeholder="example@mail.ru"
                  className="flex-1 text-white placeholder-gray-400 px-4 focus:outline-none"
                  style={{ background: '#AEABBB33', borderRadius: '32px', border: '1px solid transparent', height: '44px' }}
                  onFocus={e => (e.target.style.border = '1px solid #A1FF4A')}
                  onBlur={e => (e.target.style.border = '1px solid transparent')}
                />
                <button
                  type="button"
                  onClick={handleSendEmailCode}
                  disabled={emailLoading || !emailInput}
                  className="px-4 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all"
                  style={{ background: emailInput ? '#A1FF4A' : '#AEABBB66', color: emailInput ? '#060919' : '#AEABBB', cursor: emailInput ? 'pointer' : 'not-allowed' }}
                >
                  {emailLoading ? '...' : 'Получить код'}
                </button>
              </div>
              {emailError && <p className="text-red-400 text-xs px-2">{emailError}</p>}
              <p className="text-[#AEABBB] text-xs px-2">Подтверди email, чтобы входить в приложение без Telegram</p>
            </div>
          )}
        </div>

        {/* Игровое амплуа */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ИГРОВОЕ АМПЛУА</label>
          <div className="flex gap-3 flex-wrap">
            {/* Амплуа из общего справочника (src/lib/positions.ts): ВР, ЛЗ, ПЗ,
                ЛН, ЦН, ПН — правка владельца «Начало сентября». Старое общее
                «Защитник» (DEFENSEMAN) в пикере не предлагаем, но если оно уже
                выбрано — показываем, чтобы не терять выбор. */}
            {[
              ...POSITION_OPTIONS,
              ...(formData.position === 'DEFENSEMAN' ? (['DEFENSEMAN'] as const) : []),
            ].map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => handleInputChange('position', pos)}
                className={`px-6 py-3 rounded-full font-medium transition-all ${
                  formData.position === pos ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
                }`}
              >
                {POSITION_LABEL[pos]}
              </button>
            ))}
            <button 
              type="button"
              onClick={() => handleInputChange('position', '')}
              className={`px-6 py-3 rounded-full font-medium text-sm transition-all ${
                formData.position === '' ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
              }`}
            >
              Пока не определился
            </button>
          </div>
        </div>

        {/* Игровой номер */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ИГРОВОЙ НОМЕР</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formData.number}
            onChange={(e) => handleInputChange('number', sanitizeNumberInput(e.target.value))}
            maxLength={2}
            placeholder="00"
            className="w-full text-white placeholder-gray-400 px-4 border focus:outline-none transition-colors"
            style={{
              background: '#AEABBB33',
              borderRadius: '32px',
              border: '1px solid transparent',
              height: '44px',
            }}
            onFocus={(e) => (e.target.style.border = '1px solid #A1FF4A')}
            onBlur={(e) => (e.target.style.border = '1px solid transparent')}
          />
        </div>

        {/* Кнопка сохранения */}
        <button
          onClick={handleSubmit}
          disabled={
            isSaving ||
            !isValidName(formData.firstName, NAME_MAX_FIRST) ||
            !isValidName(formData.lastName, NAME_MAX_LAST)
          }
          className="w-full py-3 rounded-full font-bold uppercase transition-all mt-6 disabled:opacity-60"
          style={{
            background: isSaving ? '#AEABBB66' : '#A1FF4A',
            color: isSaving ? '#AEABBB' : '#060919',
            opacity: isSaving ? 0.6 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {/* Нижнее меню */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default ProfileEditPage;