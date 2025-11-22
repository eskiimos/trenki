'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegram } from '../../../hooks/useTelegram';
import { ProfileEditSkeleton } from '../../../components/Skeleton';
import BottomNavigation from '@/components/BottomNavigation';

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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    number: '',
    age: '',
    height: '',
    weight: '',
    avatarUrl: '',
    clubLogoUrl: ''
  });

  useEffect(() => {
    let cancelled = false;

    const fetchUserProfile = async () => {
      if (!user?.id || cancelled) {
        setIsLoading(false);
        return;
      }

      try {
        const telegramId = user?.id?.toString() || user?.username || 'testuser';
        console.log('Profile edit page: fetching profile for', telegramId);
        
        const response = await fetch(`/api/profile?telegramId=${telegramId}`);
        
        if (!response.ok || cancelled) {
          throw new Error('Ошибка загрузки профиля');
        }

        const data = await response.json();
        
        if (!cancelled) {
          setUserProfile(data.user);
          
          // Заполняем форму данными
          setFormData({
            firstName: data.user?.firstName || user.first_name || '',
            lastName: data.user?.lastName || user.last_name || '',
            position: data.user?.profile?.position || '',
            number: data.user?.profile?.number?.toString() || '',
            age: data.user?.profile?.age?.toString() || '',
            height: data.user?.profile?.height?.toString() || '',
            weight: data.user?.profile?.weight?.toString() || '',
            avatarUrl: data.user?.profile?.avatarUrl || '',
            clubLogoUrl: data.user?.profile?.clubLogoUrl || ''
          });
          
          // Устанавливаем превью если есть URL
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Показываем превью
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Загружаем на сервер
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData,
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
        profile: {
          position: formData.position || null,
          number: formData.number ? parseInt(formData.number) : null,
          age: formData.age ? parseInt(formData.age) : null,
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
      } else if (err?.message?.includes('Ошибка сервера:')) {
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
    <div className="bg-[#101530] min-h-screen text-white pb-24">
      {/* Шапка */}
      <div className="flex items-center justify-between p-4 pt-[100px]">
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
          disabled={isSaving}
          className="bg-[#445CFF] hover:bg-[#3a4edb] disabled:bg-[#445CFF]/50 text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wide"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить'}
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
            className="bg-gradient-to-b from-[#2A3B8F] to-[#1a2563] rounded-xl h-40 flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
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
            onChange={(e) => handleInputChange('firstName', e.target.value)}
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
        </div>

        {/* Фамилия */}
        <div>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
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
        </div>

        {/* Дата рождения */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ДАТА РОЖДЕНИЯ</label>
          <input
            type="text"
            value={formData.age}
            onChange={(e) => handleInputChange('age', e.target.value)}
            placeholder="ДД/ММ/ГГ"
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

        {/* Пол */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ПОЛ</label>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="px-6 py-3 rounded-full font-medium transition-all bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]"
            >
              М
            </button>
            <button
              type="button"
              className="px-6 py-3 rounded-full font-medium transition-all bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]"
            >
              Ж
            </button>
            <button
              type="button"
              className="px-6 py-3 rounded-full font-medium text-sm transition-all bg-[#AEABBB33] text-white hover:bg-[#A1FF4A] hover:text-[#0A0E1A]"
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
            className="bg-[#3A3955] rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:opacity-90 transition-opacity relative overflow-hidden"
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

        {/* Игровое амплуа */}
        <div>
          <label className="text-white text-sm mb-2 block uppercase">ИГРОВОЕ АМПЛУА</label>
          <div className="flex gap-3 flex-wrap">
            <button 
              type="button"
              onClick={() => handleInputChange('position', 'FORWARD')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                formData.position === 'FORWARD' ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
              }`}
            >
              Нападающий
            </button>
            <button 
              type="button"
              onClick={() => handleInputChange('position', 'DEFENSEMAN')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                formData.position === 'DEFENSEMAN' ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
              }`}
            >
              Защитник
            </button>
            <button 
              type="button"
              onClick={() => handleInputChange('position', 'GOALTENDER')}
              className={`px-6 py-3 rounded-full font-medium transition-all ${
                formData.position === 'GOALTENDER' ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
              }`}
            >
              Вратарь
            </button>
            <button 
              type="button"
              onClick={() => handleInputChange('position', 'UNDECIDED')}
              className={`px-6 py-3 rounded-full font-medium text-sm transition-all ${
                formData.position === 'UNDECIDED' ? 'bg-[#A1FF4A] text-[#060919]' : 'bg-[#AEABBB33] text-white'
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
            type="number"
            min="1"
            max="99"
            value={formData.number}
            onChange={(e) => handleInputChange('number', e.target.value)}
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
      </div>

      {/* Нижнее меню */}
      <BottomNavigation activeTab="profile" />
    </div>
  );
};

export default ProfileEditPage;