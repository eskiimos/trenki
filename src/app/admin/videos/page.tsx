'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
}

const AdminVideosPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  
  // Данные формы
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: 0,
    videoUrl: '',
    thumbnail: '',
    category: 'SKATING',
    difficulty: 'BEGINNER',
    trainerId: '',
    tags: '',
    equipment: '',
    level: '',
  });

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
      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const equipmentArray = formData.equipment.split(',').map(eq => eq.trim()).filter(eq => eq);

      const payload = {
        ...formData,
        duration: parseInt(formData.duration.toString()) || 0,
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
        alert(editingVideoId ? 'Видео успешно обновлено!' : 'Видео успешно добавлено!');
        setShowForm(false);
        setEditingVideoId(null);
        setFormData({
          title: '',
          description: '',
          duration: 0,
          videoUrl: '',
          thumbnail: '',
          category: 'SKATING',
          difficulty: 'BEGINNER',
          trainerId: trainers[0]?.id || '',
          tags: '',
          equipment: '',
          level: '',
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

  const handleEditVideo = (video: Video) => {
    setEditingVideoId(video.id);
    setFormData({
      title: video.title,
      description: video.description || '',
      duration: parseInt(video.duration.split(':')[0]) * 60 + parseInt(video.duration.split(':')[1]),
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail || '',
      category: video.category,
      difficulty: video.difficulty,
      trainerId: video.trainer.id,
      tags: video.tags.join(', '),
      equipment: video.equipment.join(', '),
      level: video.level || '',
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingVideoId(null);
    setShowForm(false);
    setFormData({
      title: '',
      description: '',
      duration: 0,
      videoUrl: '',
      thumbnail: '',
      category: 'SKATING',
      difficulty: 'BEGINNER',
      trainerId: trainers[0]?.id || '',
      tags: '',
      equipment: '',
      level: '',
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
      <div className="max-w-6xl mx-auto">
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
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">
              {editingVideoId ? 'Редактировать видео' : 'Новое видео'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Название */}
                <div>
                  <label className="block text-sm font-medium mb-2">Название *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Длительность (в секундах) */}
                <div>
                  <label className="block text-sm font-medium mb-2">Длительность (сек) *</label>
                  <input
                    type="number"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    required
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
                        {isLoading ? 'Загрузка...' : 'Получить данные'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Превью */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Превью</label>
                  <div className="space-y-2">
                    {/* Текущее превью */}
                    {formData.thumbnail && (
                      <div className="relative w-full h-32 bg-[#2d3448] rounded-lg overflow-hidden">
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
                      placeholder="URL превью или загрузите файл ниже"
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
                        Или вставьте URL выше
                      </span>
                    </div>
                  </div>
                </div>

                {/* Категория */}
                <div>
                  <label className="block text-sm font-medium mb-2">Категория *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="BEGINNER">Начальный</option>
                    <option value="INTERMEDIATE">Средний</option>
                    <option value="ADVANCED">Продвинутый</option>
                    <option value="EXPERT">Эксперт</option>
                  </select>
                </div>

                {/* Тренер */}
                <div>
                  <label className="block text-sm font-medium mb-2">Тренер *</label>
                  <select
                    name="trainerId"
                    value={formData.trainerId}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {trainers.map(trainer => (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.name} {trainer.lastName} - {trainer.speciality}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Уровень */}
                <div>
                  <label className="block text-sm font-medium mb-2">Уровень</label>
                  <input
                    type="text"
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                    placeholder="Например: Начальный, Средний"
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Теги */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Теги (через запятую)</label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="Техника, Катание, Основы, Новичок"
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Оборудование */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Оборудование (через запятую)</label>
                  <input
                    type="text"
                    name="equipment"
                    value={formData.equipment}
                    onChange={handleChange}
                    placeholder="Коньки, Шлем, Защита"
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* Описание */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

              </div>

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
