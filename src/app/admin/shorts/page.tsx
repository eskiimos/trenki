'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Short {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  trainerId?: string | null;
  tags: string[];
  isPublished: boolean;
  viewsCount: number;
  order: number;
  createdAt: string;
}

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  avatar: string | null;
}

export default function AdminShortsPage() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingShortId, setEditingShortId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [trainerId, setTrainerId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [order, setOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);
  const [audience, setAudience] = useState('HOCKEY');

  useEffect(() => {
    fetchShorts();
    fetchTrainers();
  }, []);

  const getTrainerName = (trainerId?: string | null) => {
    if (!trainerId) return 'Без автора';
    const trainer = trainers.find((t) => t.id === trainerId);
    if (!trainer) return 'Без автора';
    return `${trainer.name} ${trainer.lastName}`.trim();
  };

  const fetchShorts = async () => {
    try {
      const response = await fetch('/api/shorts');
      const data = await response.json();
      setShorts(data.shorts || []);
    } catch (error) {
      console.error('Error loading shorts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrainers = async () => {
    try {
      const response = await fetch('/api/trainers');
      const data = await response.json();
      setTrainers(data.trainers || []);
    } catch (error) {
      console.error('Error loading trainers:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const shortData = {
      title,
      description,
      videoUrl,
      thumbnail,
      trainerId: trainerId || null,
      tags,
      order,
      isPublished,
      audience,
    };

    try {
      const url = editingShortId ? `/api/shorts/${editingShortId}` : '/api/shorts';
      const method = editingShortId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shortData),
      });

      if (response.ok) {
        alert(editingShortId ? 'Тренька обновлена!' : 'Тренька добавлена!');
        resetForm();
        fetchShorts();
      } else {
        const errorData = await response.json();
        alert(`Ошибка: ${errorData.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Error saving short:', error);
      alert('Ошибка при сохранении');
    }
  };

  const handleEditShort = (short: Short) => {
    setEditingShortId(short.id);
    setTitle(short.title);
    setDescription(short.description || '');
    setVideoUrl(short.videoUrl);
    setThumbnail(short.thumbnail || '');
    setTrainerId(short.trainerId || '');
    setTags(short.tags);
    setOrder(short.order);
    setIsPublished(short.isPublished);
    setAudience((short as any).audience || 'HOCKEY');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteShort = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту тренью?')) return;

    try {
      const response = await fetch(`/api/shorts/${id}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Тренька удалена!');
        fetchShorts();
      }
    } catch (error) {
      console.error('Error deleting short:', error);
      alert('Ошибка при удалении');
    }
  };

  const resetForm = () => {
    setEditingShortId(null);
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnail('');
    setTrainerId('');
    setTags([]);
    setOrder(0);
    setIsPublished(true);
    setAudience('HOCKEY');
    setShowForm(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setThumbnail(data.path);
        alert('Изображение загружено!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Ошибка загрузки файла');
    }
  };

  const handleFetchKinescopeMetadata = async () => {
    if (!videoUrl) {
      alert('Введите URL видео');
      return;
    }

    try {
      const response = await fetch('/api/kinescope/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        if (!title) setTitle(data.title || '');
        if (!description) setDescription(data.description || '');
        if (!thumbnail) setThumbnail(data.thumbnail || '');
        alert('Метаданные загружены!');
      } else {
        const errorData = await response.json();
        alert(`Ошибка: ${errorData.error || 'Не удалось загрузить метаданные'}`);
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
      alert('Ошибка при загрузке метаданных');
    }
  };

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const videoName = file.name.replace(/\.[^/.]+$/, '');

    try {
      setUploadProgress(0);

      const initRes = await fetch('/api/kinescope/upload-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: videoName, filesize: file.size, filename: file.name }),
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        alert(`Ошибка инициализации загрузки: ${err.error}`);
        setUploadProgress(null);
        return;
      }

      const { videoId, uploadUrl } = await initRes.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
      });

      const kinescopeUrl = `https://kinescope.io/${videoId}`;
      setVideoUrl(kinescopeUrl);
      setUploadProgress(null);

      // Авто-загрузка метаданных
      try {
        const metaRes = await fetch('/api/kinescope/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: kinescopeUrl }),
        });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (!title) setTitle(meta.title || videoName);
          if (!thumbnail) setThumbnail(meta.thumbnail || '');
        }
      } catch {
        // метаданные ещё могут не быть готовы сразу
      }

      alert('Тренька успешно загружена');
    } catch (error: any) {
      console.error('Video upload error:', error);
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadProgress(null);
    }

    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-6" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
          <h1 className="text-3xl font-bold">Управление тренями</h1>
          <div className="flex flex-col w-full sm:w-auto gap-2">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 w-full sm:w-auto"
              >
                + Добавить тренью
              </button>
            )}
            <Link href="/admin" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 text-center">
              ← Назад в админку
            </Link>
          </div>
        </div>

        {/* Форма добавления/редактирования */}
        {showForm && (
          <div className="bg-[#1a1f3a] rounded-lg p-6 mb-8 border border-white/5">
          <h2 className="text-xl font-semibold mb-4">
            {editingShortId ? 'Редактировать тренью' : 'Добавить новую тренью'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium mb-2">Название *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            {/* Тренер */}
            <div>
              <label className="block text-sm font-medium mb-2">Тренер</label>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Не выбран</option>
                {trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.name} {trainer.lastName}
                  </option>
                ))}
              </select>
            </div>

            {/* Аудитория */}
            <div>
              <label className="block text-sm font-medium mb-2">Аудитория</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HOCKEY">🏒 Хоккей (trenki.app)</option>
                <option value="ADAPTIVE">♿ Адаптивный (adaptive.trenki.app)</option>
                <option value="ALL">🌐 Все платформы</option>
              </select>
            </div>

            {/* URL видео */}
            <div>
              <label className="block text-sm font-medium mb-2">URL видео *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1 px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ID или ссылка на видео"
                  required
                />
                <button
                  type="button"
                  onClick={handleFetchKinescopeMetadata}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                >
                  🔄 Получить данные
                </button>
              </div>

              {/* Загрузка файла напрямую на Kinescope */}
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-px bg-gray-600"></div>
                <span className="text-xs text-gray-400">или загрузить файл</span>
                <div className="flex-1 h-px bg-gray-600"></div>
              </div>
              <div className="mt-2">
                <label
                  htmlFor="shortsVideoFileUpload"
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploadProgress !== null ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  📁 Загрузить видеофайл
                </label>
                <input
                  id="shortsVideoFileUpload"
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFileUpload}
                  disabled={uploadProgress !== null}
                  className="hidden"
                />
                {uploadProgress !== null && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-400 mb-1">Загрузка: {uploadProgress}%</div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Превью */}
            <div>
              <label className="block text-sm font-medium mb-2">Превью (URL или загрузить файл)</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded"
                />
                {thumbnail && (
                  <Image src={thumbnail} alt="Preview" width={200} height={356} className="rounded mt-2" />
                )}
              </div>
            </div>

            {/* Теги */}
            <div>
              <label className="block text-sm font-medium mb-2">Теги (через запятую)</label>
              <input
                type="text"
                value={tags.join(', ')}
                onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="дриблинг, катание, тренировка"
              />
            </div>

            {/* Порядок отображения */}
            <div>
              <label className="block text-sm font-medium mb-2">Порядок отображения</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-full px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Опубликовано */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isPublished" className="text-sm font-medium">Опубликовано</label>
            </div>

            {/* Кнопки */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 rounded hover:bg-green-700"
              >
                {editingShortId ? 'Обновить' : 'Добавить'}
              </button>
              {editingShortId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-600 rounded hover:bg-gray-700"
                >
                  Отменить
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* Список shorts */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 border border-white/5">
          <h2 className="text-xl font-semibold mb-4">Список тренек ({shorts.length})</h2>
          
          {isLoading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : shorts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Shorts пока нет</div>
          ) : (
            <div className="space-y-2">
              {shorts.map((short) => (
                <div key={short.id} className="bg-[#2d3448] rounded-lg p-2 sm:p-3">
                  {/* Структура: превью слева, контент справа */}
                  <div className="flex gap-3 items-stretch">
                    {/* Миниатюра */}
                    <div className="w-16 h-24 sm:w-20 sm:h-28 flex-shrink-0 rounded overflow-hidden bg-black relative">
                      {short.thumbnail ? (
                        <Image 
                          src={short.thumbnail} 
                          alt={short.title} 
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <video 
                          src={short.videoUrl}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      )}
                    </div>

                    {/* Информация */}
                    <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
                      {/* Заголовок + статус */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base flex-1 min-w-0 truncate">{short.title}</h3>
                        <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${short.isPublished ? 'bg-green-600' : 'bg-gray-600'}`}>
                          {short.isPublished ? 'Опубл.' : 'Черн.'}
                        </span>
                      </div>

                      {/* Описание */}
                      {short.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{short.description}</p>
                      )}

                      {/* Мета */}
                      <div className="text-xs text-gray-500 mt-1">
                        Автор: {getTrainerName(short.trainerId)}
                      </div>
                      {short.tags.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1 hidden sm:block">
                          Теги: {short.tags.join(', ')}
                        </div>
                      )}

                      {/* Кнопки */}
                      <div className="flex gap-1.5 w-full mt-2">
                        <button
                          onClick={() => handleEditShort(short)}
                          className="flex-1 sm:flex-none px-2 sm:px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 text-xs"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDeleteShort(short.id)}
                          className="flex-1 sm:flex-none px-2 sm:px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-xs"
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
