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

export default function AdminShortsPage() {
  const [shorts, setShorts] = useState<Short[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingShortId, setEditingShortId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [order, setOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    fetchShorts();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const shortData = {
      title,
      description,
      videoUrl,
      thumbnail,
      tags,
      order,
      isPublished,
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
        alert(editingShortId ? 'Short обновлён!' : 'Short добавлен!');
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
    setTags(short.tags);
    setOrder(short.order);
    setIsPublished(short.isPublished);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteShort = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот short?')) return;

    try {
      const response = await fetch(`/api/shorts/${id}`, { method: 'DELETE' });
      if (response.ok) {
        alert('Short удалён!');
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
    setTags([]);
    setOrder(0);
    setIsPublished(true);
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

  return (
    <div className="min-h-screen bg-[#101530] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Управление Shorts</h1>
          <Link href="/admin" className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            ← Назад в админку
          </Link>
        </div>

        {/* Форма добавления/редактирования */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {editingShortId ? 'Редактировать Short' : 'Добавить новый Short'}
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

            {/* URL видео */}
            <div>
              <label className="block text-sm font-medium mb-2">URL видео (Kinescope или прямая ссылка) *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="flex-1 px-4 py-2 bg-[#2d3448] border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://kinescope.io/..."
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

        {/* Список shorts */}
        <div className="bg-[#1a1f3a] rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Список Shorts ({shorts.length})</h2>
          
          {isLoading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : shorts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Shorts пока нет</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shorts.map((short) => (
                <div key={short.id} className="bg-[#2d3448] rounded-lg p-4 relative">
                  {/* Статус */}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded text-xs ${short.isPublished ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {short.isPublished ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </div>

                  {/* Превью */}
                  {short.thumbnail && (
                    <div className="w-full aspect-[9/16] relative mb-3 rounded overflow-hidden">
                      <Image 
                        src={short.thumbnail} 
                        alt={short.title} 
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}

                  {/* Информация */}
                  <h3 className="font-semibold mb-2">{short.title}</h3>
                  <p className="text-sm text-gray-400 mb-2">Порядок: {short.order}</p>
                  <p className="text-xs text-gray-500 mb-3">Просмотры: {short.viewsCount}</p>

                  {/* Кнопки */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditShort(short)}
                      className="flex-1 px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 text-sm"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDeleteShort(short.id)}
                      className="flex-1 px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-sm"
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
}
