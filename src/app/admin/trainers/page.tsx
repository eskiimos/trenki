'use client';

import React, { useState, useEffect } from 'react';
import { pluralYears } from '@/lib/plural';
import Image from 'next/image';
import {
  AdminPage,
  PageHeader,
  SectionTitle,
  AdminCard,
  AdminButton,
  EmptyState,
  inputStyle,
  labelStyle,
} from '@/components/admin/ui';
import {
  GraduationCap,
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Star,
  CalendarDays,
  Video as VideoIcon,
  Users,
  Loader2,
} from 'lucide-react';

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
    <AdminPage>
      <PageHeader
        title="Тренеры"
        icon={GraduationCap}
        backHref="/admin"
        actions={
          !showForm ? (
            <AdminButton icon={Plus} onClick={() => setShowForm(true)}>
              Добавить тренера
            </AdminButton>
          ) : undefined
        }
      />

      {/* Форма добавления/редактирования */}
      {showForm && (
        <AdminCard style={{ marginBottom: 24 }}>
          <SectionTitle icon={GraduationCap}>
            {editingTrainerId ? 'Редактировать тренера' : 'Добавить нового тренера'}
          </SectionTitle>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Имя */}
              <div>
                <label style={labelStyle}>Имя *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                  required
                  placeholder="Александр"
                />
              </div>

              {/* Фамилия */}
              <div>
                <label style={labelStyle}>Фамилия *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                  required
                  placeholder="Иванов"
                />
              </div>

              {/* Специализация */}
              <div>
                <label style={labelStyle}>Специализация *</label>
                <input
                  type="text"
                  value={speciality}
                  onChange={(e) => setSpeciality(e.target.value)}
                  style={inputStyle}
                  required
                  placeholder="Техника катания"
                />
              </div>

              {/* Опыт работы */}
              <div>
                <label style={labelStyle}>Опыт работы (лет)</label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(parseInt(e.target.value) || 0)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  min="0"
                  placeholder="5"
                />
              </div>

              {/* Рейтинг */}
              <div>
                <label style={labelStyle}>Рейтинг</label>
                <input
                  type="number"
                  value={rating}
                  onChange={(e) => setRating(parseFloat(e.target.value) || 5.0)}
                  style={{ ...inputStyle, colorScheme: 'dark' }}
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="5.0"
                />
              </div>

            </div>

            {/* Аватар - полная ширина */}
            <div>
              <label style={labelStyle}>Аватар</label>

              {/* Превью аватара */}
              {avatar && (
                <div className="flex items-center gap-4" style={{ marginBottom: 12 }}>
                  <div
                    className="w-20 h-20 overflow-hidden shrink-0"
                    style={{ borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}
                  >
                    <Image
                      src={avatar}
                      alt="Preview"
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <AdminButton
                    type="button"
                    tone="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setAvatar('')}
                  >
                    Удалить
                  </AdminButton>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Загрузка файла */}
                <div>
                  <label style={labelStyle}>Загрузить файл</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                    style={{ ...inputStyle, padding: '8px 12px' }}
                    className="file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:cursor-pointer file:font-bold file:text-[13px] file:bg-brand file:text-night disabled:opacity-50"
                  />
                  {isUploading && (
                    <p
                      className="flex items-center gap-2"
                      style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8 }}
                    >
                      <Loader2 size={16} className="animate-spin" aria-hidden />
                      Загрузка…
                    </p>
                  )}
                </div>

                {/* Или вставить URL */}
                <div>
                  <label style={labelStyle}>Или вставить URL</label>
                  <input
                    type="text"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    style={inputStyle}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            </div>

            {/* Описание */}
            <div>
              <label style={labelStyle}>Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, minHeight: 112, resize: 'vertical' }}
                rows={4}
                placeholder="Опытный тренер с многолетним стажем..."
              />
            </div>

            {/* Кнопки */}
            <div className="flex flex-wrap gap-3">
              <AdminButton type="submit" icon={Save}>
                {editingTrainerId ? 'Обновить' : 'Добавить'}
              </AdminButton>

              {editingTrainerId && (
                <AdminButton type="button" tone="secondary" icon={X} onClick={resetForm}>
                  Отменить
                </AdminButton>
              )}
            </div>
          </form>
        </AdminCard>
      )}

      {/* Список тренеров */}
      <AdminCard>
        <SectionTitle icon={Users}>Список тренеров ({trainers.length})</SectionTitle>

        {isLoading ? (
          <EmptyState icon={Loader2} title="Загрузка…" />
        ) : trainers.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Тренеров пока нет"
            hint="Нажми «Добавить тренера» в шапке страницы"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trainers.map((trainer) => (
              <div
                key={trainer.id}
                className="flex flex-col md:flex-row gap-4 items-start md:items-center"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                }}
              >
                {/* Аватар */}
                <div
                  className="w-16 h-16 overflow-hidden shrink-0"
                  style={{ borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}
                >
                  {trainer.avatar ? (
                    <Image
                      src={trainer.avatar}
                      alt={`${trainer.name} ${trainer.lastName}`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-muted)' }}
                    >
                      {trainer.name.charAt(0)}{trainer.lastName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                    {trainer.name} {trainer.lastName}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                    {trainer.speciality}
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-4"
                    style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Star size={16} aria-hidden />
                      <span className="sr-only">Рейтинг: </span>
                      {trainer.rating.toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={16} aria-hidden />
                      Опыт: {pluralYears(trainer.experience)}
                    </span>
                    {trainer.videos && trainer.videos.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <VideoIcon size={16} aria-hidden />
                        Видео: {trainer.videos.length}
                      </span>
                    )}
                  </div>
                  {trainer.description && (
                    <p
                      className="line-clamp-2"
                      style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 8 }}
                    >
                      {trainer.description}
                    </p>
                  )}
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-2 shrink-0">
                  <AdminButton
                    size="sm"
                    tone="secondary"
                    icon={Pencil}
                    onClick={() => handleEdit(trainer)}
                  >
                    Изменить
                  </AdminButton>
                  <AdminButton
                    size="sm"
                    tone="danger"
                    icon={Trash2}
                    onClick={() => handleDelete(trainer.id)}
                  >
                    Удалить
                  </AdminButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
