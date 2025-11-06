'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MultiLevelTagFilter from '@/components/MultiLevelTagFilter';

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  speciality: string;
}

interface Video {
  id: string;
  title: string;
  description?: string;
  duration: string;
  videoUrl: string;
  thumbnail?: string;
  trainer: {
    id: string;
    name: string;
  };
  category: string;
  difficulty: string;
  tags: string[];
  equipment: string[];
  level?: string;
  isPublished: boolean;
  // Поля для алгоритма LoadType
  типМодуля?: string;
  типНагрузки?: string;
  группаМышц?: string;
  сложность?: string;
}

const AdminVideosPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]); // ID тегов из базы
  
    // Начальное состояние формы
  const initialFormState = {
    title: '',
    description: '',
    videoUrl: '',
    thumbnail: '',
    category: 'SKATING',
    difficulty: 'BEGINNER',
    trainerId: '',
    tags: '', // Оставляем для обратной совместимости (старые текстовые теги)
    equipment: '',
    // Поля для алгоритма тренировок (LoadType-based)
    типМодуля: '',
    типНагрузки: '', // Основное поле - создаёт LoadType тег автоматически
    группаМышц: '',
    сложность: '',
  };
  
  // Данные формы
  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchTrainers();
    fetchVideos();
  }, []);

  const fetchTrainers = async () => {
    try {
      const response = await fetch('/api/trainers');
      const data = await response.json();
      setTrainers(data.trainers || []);
      if (data.trainers && data.trainers.length > 0) {
        setFormData(prev => ({ ...prev, trainerId: data.trainers[0].id }));
      }
    } catch (error) {
      console.error('Error fetching trainers:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      // Добавляем timestamp чтобы избежать кэширования
      const response = await fetch(`/api/videos/all?t=${Date.now()}`);
      const data = await response.json();
      console.log('Fetched videos:', data.videos);
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Старые текстовые теги (для обратной совместимости)
      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const equipmentArray = formData.equipment.split(',').map(eq => eq.trim()).filter(eq => eq);

      const payload = {
        ...formData,
        tags: tagsArray,
        equipment: equipmentArray,
        isPublished: true,
      };

      console.log('Sending payload:', payload);

      const url = editingVideoId ? `/api/videos/${editingVideoId}` : '/api/videos';
      const method = editingVideoId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (response.ok) {
        // Если есть выбранные теги из базы, создаем связи VideoTag
        if (selectedTagIds.length > 0) {
          const videoId = editingVideoId || data.id;
          
          // Если редактируем, сначала удаляем старые связи
          if (editingVideoId) {
            await fetch(`/api/videos/${videoId}/tags`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            });
          }
          
          // Создаем новые связи с тегами
          await fetch(`/api/videos/${videoId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagIds: selectedTagIds }),
          });
        }
        
        alert(editingVideoId ? 'Видео успешно обновлено!' : 'Видео успешно добавлено!');
        setShowForm(false);
        setEditingVideoId(null);
        setSelectedTagIds([]); // Очищаем выбранные теги
        setFormData({
          ...initialFormState,
          trainerId: trainers[0]?.id || '',
        });
        fetchVideos();
      } else {
        alert(`Ошибка: ${data.error}${data.details ? '\nДетали: ' + data.details : ''}`);
      }
    } catch (error) {
      console.error('Error saving video:', error);
      alert('Произошла ошибка при сохранении видео');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 5MB');
      return;
    }

    try {
      setIsLoading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const data = await response.json();

      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          thumbnail: data.path
        }));
        alert('Превью успешно загружено!');
      } else {
        alert(`Ошибка загрузки: ${data.error}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Произошла ошибка при загрузке файла');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchKinescopeMetadata = async () => {
    if (!formData.videoUrl) {
      alert('Сначала введите URL видео');
      return;
    }

    try {
      setIsLoading(true);
      console.log('Fetching Kinescope metadata for:', formData.videoUrl);
      
      const response = await fetch('/api/kinescope/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl: formData.videoUrl }),
      });

      const data = await response.json();
      console.log('Kinescope metadata response:', data);

      if (response.ok && data.success) {
        const updates: any = {};
        let updatedFields: string[] = [];

        if (data.duration && data.duration > 0) {
          updates.duration = data.duration;
          updatedFields.push('длительность');
        }
        
        if (data.thumbnail) {
          updates.thumbnail = data.thumbnail;
          updatedFields.push('превью');
        }
        
        if (data.title && !formData.title) {
          updates.title = data.title;
          updatedFields.push('название');
        }
        
        if (data.description && !formData.description) {
          updates.description = data.description;
          updatedFields.push('описание');
        }

        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({
            ...prev,
            ...updates,
          }));
          
          alert(`Данные успешно получены из Kinescope!\n\nОбновлено: ${updatedFields.join(', ')}`);
        } else {
          alert('Все данные уже заполнены или не найдены в Kinescope');
        }
      } else {
        console.error('Kinescope API error:', data);
        let errorMessage = 'Ошибка при получении данных из Kinescope';
        
        if (data.error) {
          errorMessage += `\n\n${data.error}`;
        }
        
        if (data.message) {
          errorMessage += `\n${data.message}`;
        }
        
        if (data.details) {
          errorMessage += `\n\nДетали: ${data.details}`;
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error fetching Kinescope metadata:', error);
      alert('Произошла ошибка при получении данных.\nПроверьте консоль для деталей.');
    } finally {
      setIsLoading(false);
    }
  };

    const handleEditVideo = async (video: Video) => {
    setEditingVideoId(video.id);
    setFormData({
      title: video.title,
      description: video.description || '',
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail || '',
      category: video.category,
      difficulty: video.difficulty,
      trainerId: video.trainer.id,
      tags: video.tags.join(', '), // Старые текстовые теги
      equipment: video.equipment.join(', '),
      // Поля для алгоритма (LoadType-based)
      типМодуля: video.типМодуля || '',
      типНагрузки: video.типНагрузки || '', // Основное поле - LoadType тег
      группаМышц: video.группаМышц || '',
      сложность: video.сложность || '',
    });
    
    // Загружаем теги из базы данных для этого видео
    try {
      const response = await fetch(`/api/videos/${video.id}/tags`);
      if (response.ok) {
        const data = await response.json();
        // data.tags - массив объектов Tag с полем id
        setSelectedTagIds(data.tags.map((tag: { id: string }) => tag.id));
      }
    } catch (error) {
      console.error('Error loading video tags:', error);
      setSelectedTagIds([]);
    }
    
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingVideoId(null);
    setShowForm(false);
    setSelectedTagIds([]); // Очищаем выбранные теги
    setFormData({
      ...initialFormState,
      trainerId: trainers[0]?.id || '',
    });
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это видео? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Видео успешно удалено!');
        fetchVideos();
      } else {
        const data = await response.json();
        alert(`Ошибка при удалении: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Произошла ошибка при удалении видео');
    }
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link href="/admin" className="inline-block text-blue-400 hover:text-blue-300 text-sm">
            ← Назад в админ-панель
          </Link>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Управление видео</h1>
          <button
            onClick={() => {
              if (showForm && editingVideoId) {
                handleCancelEdit();
              } else {
                setShowForm(!showForm);
              }
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            {showForm ? 'Отмена' : '+ Добавить видео'}
          </button>
        </div>

        {/* Форма добавления/редактирования видео */}
        {showForm && (
          <div className="bg-[#1a1f3a] rounded-lg p-4 md:p-6 mb-6 md:mb-8 border border-white/5">
            <div className="flex items-start justify-between mb-4 md:mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">
                  {editingVideoId ? 'Редактировать видео' : 'Новое видео'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  LoadType теги создаются автоматически на основе "Типа физической нагрузки"
                </p>
              </div>
              {formData.типНагрузки && (
                <div className="hidden md:block">
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg">
                    <p className="text-xs text-white/70">Развивает</p>
                    <p className="text-sm font-bold text-white">
                      {(() => {
                        const charMap: any = {
                          'MAX_STRENGTH': '💪 Силу',
                          'POWER': '💪 Силу',
                          'SPEED': '⚡ Скорость',
                          'STRENGTH_ENDURANCE': '🫀 Выносливость',
                          'ANAEROBIC_ENDURANCE': '🫀 Выносливость',
                          'AEROBIC_ENDURANCE': '🫀 Выносливость',
                          'AGILITY': '🎯 Технику',
                          'MOBILITY': '🤸 Гибкость',
                          'TECHNICAL_SKILL': '🎯 Технику',
                          'STATIC_STRETCH': '🤸 Гибкость',
                          'DYNAMIC_STRETCH': '🤸 Гибкость',
                          'PREHAB': '🤸 Гибкость',
                        };
                        return charMap[formData.типНагрузки] || '—';
                      })()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 📹 Основная информация о видео */}
              <fieldset className="border border-blue-500/30 rounded-lg p-4 md:p-6 bg-blue-900/5">
                <legend className="px-3 text-base font-bold text-blue-300">📹 Видео и медиа</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  
                  {/* Название */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Название *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      required
                      placeholder="Например: Разминка для хоккеистов"
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* URL видео */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">URL видео *</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        name="videoUrl"
                        value={formData.videoUrl}
                        onChange={handleChange}
                        required
                        placeholder="https://kinescope.io/..."
                        className="flex-1 bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      {formData.videoUrl && formData.videoUrl.includes('kinescope.io') && (
                        <button
                          type="button"
                          onClick={handleFetchKinescopeMetadata}
                          disabled={isLoading}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isLoading ? 'Загрузка...' : '🔄 Получить данные'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      💡 После вставки URL нажмите "Получить данные" для автозаполнения превью
                    </p>
                  </div>

                  {/* Превью */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Превью</label>
                    <div className="space-y-3">
                      {/* Текущее превью */}
                      {formData.thumbnail && (
                        <div className="relative w-full h-40 bg-[#2d3448] rounded-lg overflow-hidden">
                          <img 
                            src={formData.thumbnail} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* URL превью */}
                      <input
                        type="text"
                        name="thumbnail"
                        value={formData.thumbnail}
                        onChange={handleChange}
                        placeholder="URL превью (заполнится автоматически или вставьте свой)"
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      
                      {/* Загрузка файла */}
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <label 
                          htmlFor="thumbnail-upload"
                          className="cursor-pointer bg-[#3d4759] hover:bg-[#4d5769] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          📁 Загрузить с устройства
                        </label>
                        <span className="text-xs text-gray-400">
                          Опционально: загрузите своё превью
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Описание */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Опишите видео: цели, особенности, кому подходит..."
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                </div>
              </fieldset>

              {/* 🎯 Категоризация */}
              <fieldset className="border border-green-500/30 rounded-lg p-4 md:p-6 bg-green-900/5">
                <legend className="px-3 text-base font-bold text-green-300">🎯 Категория и классификация</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">

                  {/* Категория */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Категория *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="STRENGTH">Сила</option>
                      <option value="ENDURANCE">Выносливость</option>
                      <option value="SPEED">Скорость</option>
                      <option value="TECHNIQUE">Техника</option>
                      <option value="SKATING">Катание</option>
                      <option value="SHOOTING">Броски</option>
                      <option value="PASSING">Пас</option>
                      <option value="CHECKING">Силовая борьба</option>
                      <option value="GOALKEEPER">Вратарь</option>
                      <option value="TACTICAL">Тактика</option>
                      <option value="GENERAL">Общая</option>
                    </select>
                  </div>

                  {/* Сложность */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Сложность *</label>
                    <select
                      name="difficulty"
                      value={formData.difficulty}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="BEGINNER">Начальный</option>
                      <option value="INTERMEDIATE">Средний</option>
                      <option value="ADVANCED">Продвинутый</option>
                      <option value="EXPERT">Эксперт</option>
                    </select>
                  </div>

                  {/* Тренер */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Тренер *</label>
                    <select
                      name="trainerId"
                      value={formData.trainerId}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      {trainers.map(trainer => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name} {trainer.lastName} - {trainer.speciality}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Теги */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Теги</label>
                    <MultiLevelTagFilter 
                      selectedTags={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                    />
                  </div>

                  {/* Оборудование */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Необходимое оборудование</label>
                    <input
                      type="text"
                      name="equipment"
                      value={formData.equipment}
                      onChange={handleChange}
                      placeholder="Коньки, Шлем, Клюшка, Шайба (через запятую)"
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>

                </div>
              </fieldset>

              {/* ⚙️ Параметры для алгоритма тренировок */}
              <fieldset className="border border-purple-500/30 rounded-lg p-4 md:p-6 bg-purple-900/10">
                <legend className="px-3 text-base font-bold text-purple-300">⚙️ Параметры для умного алгоритма</legend>
                
                {/* Подсказка */}
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-300">
                    💡 Эти параметры используются алгоритмом для автоматического подбора видео в персональные тренировки
                  </p>
                </div>

                <div className="space-y-6">
                  
                  {/* Строка 1: ТИП НАГРУЗКИ (ГЛАВНОЕ!) */}
                  <div className="space-y-4">
                    
                    {/* Тип нагрузки - ГЛАВНОЕ ПОЛЕ */}
                    <div className="bg-purple-900/20 border-2 border-purple-500/50 rounded-lg p-4">
                      <label className="block text-base font-bold mb-2 text-purple-300">
                        🎯 Тип физической нагрузки
                        <span className="text-yellow-400 ml-1">★</span>
                      </label>
                      <select
                        name="типНагрузки"
                        value={formData.типНагрузки}
                        onChange={handleChange}
                        className="w-full bg-[#2d3448] text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-base"
                      >
                        <option value="">⚠️ Выберите тип нагрузки</option>
                        <optgroup label="💪 Сила и мощность">
                          <option value="MAX_STRENGTH">Максимальная сила</option>
                          <option value="POWER">Мощность</option>
                          <option value="SPEED">Скорость</option>
                        </optgroup>
                        <optgroup label="🫀 Выносливость">
                          <option value="STRENGTH_ENDURANCE">Силовая выносливость</option>
                          <option value="ANAEROBIC_ENDURANCE">Анаэробная выносливость</option>
                          <option value="AEROBIC_ENDURANCE">Аэробная выносливость</option>
                        </optgroup>
                        <optgroup label="🎯 Функциональные качества">
                          <option value="AGILITY">Ловкость</option>
                          <option value="MOBILITY">Мобильность</option>
                          <option value="TECHNICAL_SKILL">Технические навыки</option>
                        </optgroup>
                        <optgroup label="🤸 Восстановление">
                          <option value="STATIC_STRETCH">Статическая растяжка</option>
                          <option value="DYNAMIC_STRETCH">Динамическая растяжка</option>
                          <option value="PREHAB">ЛФК (профилактика травм)</option>
                        </optgroup>
                      </select>
                      <p className="text-sm text-purple-200 mt-2 font-medium">
                        ⭐ Это главное поле! Определяет какие характеристики развивает видео
                      </p>
                    </div>

                  </div>

                  {/* Информация о влиянии на характеристики - СРАЗУ ПОСЛЕ ВЫБОРА */}
                  {formData.типНагрузки && (
                    <div className="p-4 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                      <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                        ✨ Влияние на характеристики пользователя
                      </h4>
                      
                      {(() => {
                        // Определяем, какая характеристика развивается
                        const loadTypeImpact: { 
                          [key: string]: { 
                            char: string; 
                            emoji: string; 
                            description: string;
                            loadTypeName: string;
                            gains: { char: string; multiplier: number }[];
                          } 
                        } = {
                          'MAX_STRENGTH': { 
                            char: 'Сила', 
                            emoji: '💪', 
                            description: 'Развивает максимальную силу мышц',
                            loadTypeName: 'Максимальная сила',
                            gains: [
                              { char: 'Сила', multiplier: 1.5 }
                            ]
                          },
                          'POWER': { 
                            char: 'Сила', 
                            emoji: '💪', 
                            description: 'Развивает взрывную силу и мощность',
                            loadTypeName: 'Мощность',
                            gains: [
                              { char: 'Сила', multiplier: 1.5 },
                              { char: 'Скорость', multiplier: 0.75 }
                            ]
                          },
                          'SPEED': { 
                            char: 'Скорость', 
                            emoji: '⚡', 
                            description: 'Развивает скоростные качества',
                            loadTypeName: 'Скорость',
                            gains: [
                              { char: 'Скорость', multiplier: 1.5 },
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'STRENGTH_ENDURANCE': { 
                            char: 'Выносливость', 
                            emoji: '🫀', 
                            description: 'Развивает силовую выносливость',
                            loadTypeName: 'Силовая выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'ANAEROBIC_ENDURANCE': { 
                            char: 'Выносливость', 
                            emoji: '🫀', 
                            description: 'Развивает анаэробную выносливость',
                            loadTypeName: 'Анаэробная выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'AEROBIC_ENDURANCE': { 
                            char: 'Выносливость', 
                            emoji: '🫀', 
                            description: 'Развивает аэробную выносливость',
                            loadTypeName: 'Аэробная выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'AGILITY': { 
                            char: 'Техника', 
                            emoji: '🎯', 
                            description: 'Развивает ловкость и координацию',
                            loadTypeName: 'Ловкость',
                            gains: [
                              { char: 'Техника', multiplier: 1.5 }
                            ]
                          },
                          'MOBILITY': { 
                            char: 'Гибкость', 
                            emoji: '🤸', 
                            description: 'Улучшает подвижность суставов',
                            loadTypeName: 'Мобильность',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'TECHNICAL_SKILL': { 
                            char: 'Техника', 
                            emoji: '🎯', 
                            description: 'Совершенствует технические навыки',
                            loadTypeName: 'Технические навыки',
                            gains: [
                              { char: 'Техника', multiplier: 1.5 }
                            ]
                          },
                          'STATIC_STRETCH': { 
                            char: 'Гибкость', 
                            emoji: '🤸', 
                            description: 'Улучшает гибкость через статическую растяжку',
                            loadTypeName: 'Статическая растяжка',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'DYNAMIC_STRETCH': { 
                            char: 'Гибкость', 
                            emoji: '🤸', 
                            description: 'Улучшает гибкость через динамическую растяжку',
                            loadTypeName: 'Динамическая растяжка',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'PREHAB': { 
                            char: 'Гибкость', 
                            emoji: '🤸', 
                            description: 'Профилактика травм и восстановление',
                            loadTypeName: 'ЛФК',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Сила', multiplier: 0.75 }
                            ]
                          },
                        };

                        const impact = loadTypeImpact[formData.типНагрузки];
                        
                        if (!impact) return null;

                        // Расчёт примерного прироста для пользователя с характеристикой 70
                        const exampleCurrentValue = 70;
                        const baseGain = 0.5;
                        const calculateExampleGain = (multiplier: number) => {
                          const gain = baseGain * ((100 - exampleCurrentValue) / 100) * multiplier;
                          return gain.toFixed(2);
                        };

                        return (
                          <div className="space-y-3">
                            {/* Заголовок + LoadType badge в одну строку */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="text-2xl">{impact.emoji}</div>
                                <div>
                                  <p className="font-semibold text-white text-sm">{impact.char}</p>
                                  <p className="text-[10px] text-gray-400">{impact.description}</p>
                                </div>
                              </div>
                              <div className="px-2 py-1 bg-purple-600/40 rounded text-[10px] text-purple-100 border border-purple-400/30 whitespace-nowrap">
                                {impact.loadTypeName}
                              </div>
                            </div>
                            
                            {/* Прирост - компактно */}
                            <div className="p-2 bg-black/20 rounded border border-green-500/20">
                              <p className="text-[10px] font-semibold text-green-300 mb-1">📈 Прирост за модуль (при характеристике 70):</p>
                              <div className="flex flex-wrap gap-2">
                                {impact.gains.map((gain, idx) => (
                                  <div key={idx} className="px-2 py-1 bg-green-900/20 rounded border border-green-500/30 text-xs">
                                    <span className="text-gray-300">
                                      {gain.char === 'Сила' && '💪'} 
                                      {gain.char === 'Скорость' && '⚡'} 
                                      {gain.char === 'Выносливость' && '🫀'} 
                                      {gain.char === 'Техника' && '🎯'} 
                                      {gain.char === 'Гибкость' && '🤸'} 
                                    </span>
                                    <span className="font-mono text-green-400 font-bold ml-1">
                                      +{calculateExampleGain(gain.multiplier)}
                                      {gain.multiplier === 1.5 && <span className="text-yellow-400 ml-0.5">⭐</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Строка 2: Тип модуля и сложность */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Тип модуля */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Тип модуля в тренировке
                      </label>
                      <select
                        name="типМодуля"
                        value={formData.типМодуля}
                        onChange={handleChange}
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="">Не указано</option>
                        <option value="Разминка">🔥 Разминка</option>
                        <option value="ОФП">💪 ОФП (физподготовка)</option>
                        <option value="Техника">🎯 Техника</option>
                        <option value="Заминка">🧘 Заминка</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">В какой части тренировки используется</p>
                    </div>

                    {/* Сложность для алгоритма */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Уровень подготовки
                      </label>
                      <select
                        name="сложность"
                        value={formData.сложность}
                        onChange={handleChange}
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="">Не указано</option>
                        <option value="Новичок">🟢 Новичок</option>
                        <option value="Любитель">🔵 Любитель</option>
                        <option value="Продвинутый">🟠 Продвинутый</option>
                        <option value="Профи">🔴 Профи</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Для кого подходит упражнение</p>
                    </div>

                  </div>

                  {/* Строка 3: Группа мышц */}
                  <div className="grid grid-cols-1 gap-4">
                    
                    {/* Группа мышц */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Целевая группа мышц
                      </label>
                      <select
                        name="группаМышц"
                        value={formData.группаМышц}
                        onChange={handleChange}
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      >
                        <option value="">Не указано</option>
                        <option value="Все тело">🔄 Все тело</option>
                        <option value="Низ тела">🦵 Низ тела (ноги)</option>
                        <option value="Верх тяга">💪 Верх тела (тяга)</option>
                        <option value="Верх жим">🏋️ Верх тела (жим)</option>
                        <option value="Кор стабилизация">⚖️ Кор стабилизация</option>
                        <option value="Кор динамика">🔥 Кор динамика</option>
                        <option value="ЛФК плечо">🩹 ЛФК плечо</option>
                        <option value="ЛФК колено">🩹 ЛФК колено</option>
                        <option value="ЛФК спина">🩹 ЛФК спина</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">На какие мышцы воздействует</p>
                    </div>

                  </div>

                </div>
              </fieldset>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full sm:w-auto px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Сохранение...' : editingVideoId ? 'Сохранить изменения' : 'Добавить видео'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список видео */}
        <div className="bg-[#1a1f3a] rounded-lg p-4 md:p-6 border border-white/5">
          <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Все видео</h2>
          {videos.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Видео пока нет. Добавьте первое!</p>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div key={video.id} className="bg-[#2d3448] rounded-lg p-4 relative">
                  {/* Статус в правом верхнем углу */}
                  <div className="absolute top-4 right-4">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${video.isPublished ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {video.isPublished ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </div>
                  
                  {/* Название видео */}
                  <h3 className="font-semibold text-base md:text-lg mb-2 pr-28">{video.title}</h3>
                  
                  {/* Тип модуля (если указан) */}
                  {video.типМодуля && (
                    <div className="mb-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        video.типМодуля === 'Разминка' ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30' :
                        video.типМодуля === 'ОФП' ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' :
                        video.типМодуля === 'Техника' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' :
                        video.типМодуля === 'Заминка' ? 'bg-green-600/20 text-green-300 border border-green-500/30' :
                        'bg-gray-600/20 text-gray-300 border border-gray-500/30'
                      }`}>
                        {video.типМодуля === 'Разминка' ? '🔥' :
                         video.типМодуля === 'ОФП' ? '💪' :
                         video.типМодуля === 'Техника' ? '🎯' :
                         video.типМодуля === 'Заминка' ? '🧘' : '📹'}
                        {video.типМодуля}
                      </span>
                    </div>
                  )}
                  
                  {/* Информация о тренере */}
                  <p className="text-xs md:text-sm text-gray-400 mb-2 truncate">
                    Тренер: {video.trainer.name}
                  </p>
                  
                  {/* Категория и длительность */}
                  <p className="text-xs md:text-sm text-gray-400 mb-3">
                    {video.category} • {video.duration}
                  </p>
                  
                  {/* Кнопки */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => handleEditVideo(video)}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Редактировать
                    </button>
                    <Link 
                      href={`/video/${video.id}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Просмотр
                    </Link>
                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminVideosPage;
