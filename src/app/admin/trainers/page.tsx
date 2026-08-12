'use client';

import React, { useState, useEffect } from 'react';
import { pluralYears } from '@/lib/plural';
import Link from 'next/link';
import Image from 'next/image';

interface Trainer {
  id: string;
  name: string;
  lastName: string;
  speciality: string;
  experience: number;
  rating: number;
  avatar: string | null;
  description: string | null;
  createdAt: string;
  videos?: Array<{ id: string; title: string }>;
}

export default function AdminTrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTrainerId, setEditingTrainerId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [experience, setExperience] = useState(0);
  const [rating, setRating] = useState(5.0);
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      const response = await fetch('/api/trainers');
      const data = await response.json();
      setTrainers(data.trainers || []);
    } catch (error) {
      console.error('Ошибка загрузки тренеров:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trainerData = {
      name,
      lastName,
      speciality,
      experience,
      rating,
      avatar: avatar || null,
      description: description || null,
    };

    try {
      const url = editingTrainerId ? `/api/trainers/${editingTrainerId}` : '/api/trainers';
      const method = editingTrainerId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainerData),
      });

      if (response.ok) {
        alert(editingTrainerId ? 'Тренер обновлён!' : 'Тренер добавлен!');
        resetForm();
        fetchTrainers();
      } else if (response.status === 401) {
        alert('Сессия администратора истекла. Войдите заново.');
        window.location.href = '/admin/login';
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Ошибка: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Ошибка сохранения тренера:', error);
      alert('Ошибка сохранения тренера');
    }
  };

  const handleEdit = (trainer: Trainer) => {
    setEditingTrainerId(trainer.id);
    setName(trainer.name);
    setLastName(trainer.lastName);
    setSpeciality(trainer.speciality);
    setExperience(trainer.experience);
    setRating(trainer.rating);
    setAvatar(trainer.avatar || '');
    setDescription(trainer.description || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого тренера?')) return;

    try {
      const response = await fetch(`/api/trainers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Тренер удалён!');
        fetchTrainers();
      } else {
        const errorData = await response.json();
        alert(`Ошибка: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Ошибка удаления тренера:', error);
      alert('Ошибка удаления тренера');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Размер файла не должен превышать 5MB');
      return;
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      alert('Можно загружать только изображения');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Upload response:', data);
        setAvatar(data.url);
        alert('Аватар загружен успешно!');
      } else {
        const errorData = await response.json();
        console.error('Upload error:', errorData);
        alert(`Ошибка загрузки: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      alert('Ошибка загрузки аватара');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setEditingTrainerId(null);
    setName('');
    setLastName('');
    setSpeciality('');
    setExperience(0);
    setRating(5.0);
    setAvatar('');
    setDescription('');
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Заголовок и кнопки */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Управление тренерами</h1>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
              >
                + Добавить тренера
              </button>
            )}
            <Link href="/admin" className="w-full sm:w-auto">
              <button className="w-full px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
                ← Назад в админку
              </button>
            </Link>
          </div>
        </div>

        {/* Форма добавления/редактирования */}
        {showForm && (
        <div className="bg-[#1a1f3a] rounded-lg p-4 md:p-6 mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold mb-4">
            {editingTrainerId ? 'Редактировать тренера' : 'Добавить нового тренера'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Имя */}
              <div>
                <label className="block text-sm font-medium mb-2">Имя *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                  placeholder="Александр"
                />
              </div>

              {/* Фамилия */}
              <div>
                <label className="block text-sm font-medium mb-2">Фамилия *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                  placeholder="Иванов"
                />
              </div>

              {/* Специализация */}
              <div>
                <label className="block text-sm font-medium mb-2">Специализация *</label>
                <input
                  type="text"
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                  placeholder="Техника катания"
                />
              </div>

              {/* Опыт работы */}
              <div>
                <label className="block text-sm font-medium mb-2">Опыт работы (лет)</label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                  min="0"
                  placeholder="5"
                />
              </div>

              {/* Рейтинг */}
              <div>
                <label className="block text-sm font-medium mb-2">Рейтинг</label>
                <input
                  type="number"
                  value={rating}
                  onChange={(e) => setRating(parseFloat(e.target.value) || 5.0)}
                  className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="5.0"
                />
              </div>

            </div>

            {/* Аватар - полная ширина */}
            <div>
              <label className="block text-sm font-medium mb-2">Аватар</label>
              
              {/* Превью аватара */}
              {avatar && (
                <div className="mb-3 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-700">
                    <Image
                      src={avatar}
                      alt="Preview"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Загрузка файла */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Загрузить файл</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                    className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer"
                  />
                  {isUploading && (
                    <p className="text-sm text-blue-400 mt-2">Загрузка...</p>
                  )}
                </div>

                {/* Или вставить URL */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Или вставить URL</label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 rounded bg-[#101530] border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                rows={4}
                placeholder="Опытный тренер с многолетним стажем..."
              />
            </div>

            {/* Кнопки */}
            <div className="flex gap-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
              >
                {editingTrainerId ? 'Обновить' : 'Добавить'}
              </button>
              
              {editingTrainerId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                >
                  Отменить
                </button>
              )}
            </div>
          </form>
        </div>
        )}

        {/* Список тренеров */}
        <div className="bg-[#1a1f3a] rounded-lg p-4 md:p-6">
          <h2 className="text-xl md:text-2xl font-bold mb-4">Список тренеров</h2>
          
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Загрузка...</div>
          ) : trainers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Нет тренеров</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {trainers.map((trainer) => (
                <div
                  key={trainer.id}
                  className="bg-[#101530] rounded-lg p-4 flex flex-col md:flex-row gap-4 items-start md:items-center"
                >
                  {/* Аватар */}
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                    {trainer.avatar ? (
                      <Image
                        src={trainer.avatar}
                        alt={`${trainer.name} ${trainer.lastName}`}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">
                        {trainer.name.charAt(0)}{trainer.lastName.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Информация */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold">
                      {trainer.name} {trainer.lastName}
                    </h3>
                    <p className="text-sm text-gray-400">{trainer.speciality}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>⭐ {trainer.rating.toFixed(1)}</span>
                      <span>📅 Опыт: {pluralYears(trainer.experience)}</span>
                      {trainer.videos && trainer.videos.length > 0 && (
                        <span>🎥 Видео: {trainer.videos.length}</span>
                      )}
                    </div>
                    {trainer.description && (
                      <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                        {trainer.description}
                      </p>
                    )}
                  </div>

                  {/* Кнопки действий */}
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(trainer)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Изменить
                    </button>
                    <button
                      onClick={() => handleDelete(trainer.id)}
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
}
