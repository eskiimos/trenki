'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Определяем типы данных, которые будем использовать
interface Video {
  id: string;
  title: string;
  duration: number;
}

interface TrainingModule {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  duration: number;
  videoId?: string | null;
  video?: {
    title: string;
  } | null;
  loadType?: string | null;
  muscleGroup?: string | null;
  complexity: string;
  rpeMin?: number | null;
  rpeMax?: number | null;
  order: number;
}

const AdminTrainingModulesPage = () => {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  const initialFormData = {
    name: '',
    description: '',
    type: 'WARMUP',
    videoId: '',
    loadType: 'NOT_SPECIFIED',
    muscleGroup: 'NOT_SPECIFIED',
    complexity: 'BEGINNER',
    rpeMin: 3,
    rpeMax: 5,
    order: 0,
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    fetchModules();
    fetchVideos();
  }, []);

  const fetchModules = async () => {
    try {
      const response = await fetch(`/api/training/modules?t=${Date.now()}`);
      const data = await response.json();
      if (data.success) {
        setModules(data.modules);
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
    }
  };

  const fetchVideos = async () => {
    try {
      const response = await fetch(`/api/videos/all?t=${Date.now()}`);
      const data = await response.json();
      if (data.videos) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rpeMin' || name === 'rpeMax' || name === 'order' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const url = editingModuleId ? `/api/training/modules/${editingModuleId}` : '/api/training/modules';
    const method = editingModuleId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`Модуль успешно ${editingModuleId ? 'обновлен' : 'создан'}!`);
        setShowForm(false);
        setEditingModuleId(null);
        setFormData(initialFormData);
        fetchModules();
      } else {
        alert(`Ошибка: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving module:', error);
      alert('Произошла ошибка при сохранении модуля.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (module: TrainingModule) => {
    setEditingModuleId(module.id);
    setFormData({
      name: module.name,
      description: module.description || '',
      type: module.type,
      videoId: module.videoId || '',
      loadType: module.loadType || 'NOT_SPECIFIED',
      muscleGroup: module.muscleGroup || 'NOT_SPECIFIED',
      complexity: module.complexity,
      rpeMin: module.rpeMin || 0,
      rpeMax: module.rpeMax || 0,
      order: module.order || 0,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот модуль?')) return;

    try {
      const response = await fetch(`/api/training/modules/${moduleId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (response.ok) {
        alert('Модуль удален!');
        fetchModules();
      } else {
        alert(`Ошибка удаления: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting module:', error);
      alert('Произошла ошибка при удалении.');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingModuleId(null);
    setFormData(initialFormData);
  };

  // Значения для dropdowns
  const moduleTypes = ['WARMUP', 'FITNESS', 'TECHNIQUE', 'COOLDOWN'];
  const loadTypes = ['SPEED', 'POWER', 'MAX_STRENGTH', 'STRENGTH_ENDURANCE', 'ANAEROBIC_ENDURANCE', 'AEROBIC_ENDURANCE', 'AGILITY', 'MOBILITY', 'STATIC_STRETCH', 'DYNAMIC_STRETCH', 'PREHAB', 'TECHNICAL_SKILL', 'NOT_SPECIFIED'];
  const muscleGroups = ['LOWER_BODY', 'UPPER_PULL', 'UPPER_PUSH', 'CORE_STABILITY', 'CORE_DYNAMICS', 'PREHAB_SHOULDER', 'PREHAB_KNEE', 'PREHAB_BACK', 'FULL_BODY', 'NOT_SPECIFIED'];
  const complexities = ['BEGINNER', 'AMATEUR', 'ADVANCED', 'PRO'];

  return (
    <div className="min-h-screen bg-[#101530] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4">
          <Link href="/admin" className="text-blue-400 hover:text-blue-300 text-sm">
            ← Назад в админ-панель
          </Link>
        </div>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Тренировочные модули</h1>
          <button
            onClick={() => { showForm ? handleCancel() : setShowForm(true) }}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-semibold transition-colors"
          >
            {showForm ? 'Отмена' : '+ Создать модуль'}
          </button>
        </div>

        {showForm && (
          <div className="bg-[#1a1f3a] rounded-lg p-6 mb-8 border border-white/5">
            <h2 className="text-2xl font-bold mb-6">{editingModuleId ? 'Редактировать модуль' : 'Новый модуль'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Основные поля */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Название *</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full bg-[#2d3448] px-4 py-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Тип модуля *</label>
                  <select name="type" value={formData.type} onChange={handleChange} required className="w-full bg-[#2d3448] px-4 py-2 rounded-lg">
                    {moduleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Описание</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Видео (необязательно)</label>
                  <select name="videoId" value={formData.videoId} onChange={handleChange} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg">
                    <option value="">Без видео</option>
                    {videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </select>
                </div>
                 <div>
                  <label className="block text-sm font-medium mb-2">Порядок</label>
                  <input type="number" name="order" value={formData.order} onChange={handleChange} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg" />
                </div>
              </div>

              {/* Параметры для алгоритма */}
              <fieldset className="border border-white/10 rounded-lg p-4">
                <legend className="px-2 font-semibold">Параметры для алгоритма</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Тип нагрузки</label>
                    <select name="loadType" value={formData.loadType} onChange={handleChange} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg">
                      {loadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Группа мышц</label>
                    <select name="muscleGroup" value={formData.muscleGroup} onChange={handleChange} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg">
                      {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Сложность</label>
                    <select name="complexity" value={formData.complexity} onChange={handleChange} className="w-full bg-[#2d3448] px-4 py-2 rounded-lg">
                      {complexities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">RPE Min (1-10)</label>
                    <input type="number" name="rpeMin" value={formData.rpeMin} onChange={handleChange} min="1" max="10" className="w-full bg-[#2d3448] px-4 py-2 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">RPE Max (1-10)</label>
                    <input type="number" name="rpeMax" value={formData.rpeMax} onChange={handleChange} min="1" max="10" className="w-full bg-[#2d3448] px-4 py-2 rounded-lg" />
                  </div>
                </div>
              </fieldset>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={handleCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg">Отмена</button>
                <button type="submit" disabled={isLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
                  {isLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Список модулей */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 border border-white/5">
          <h2 className="text-xl font-bold mb-4">Все модули ({modules.length})</h2>
          <div className="space-y-3">
            {modules.length > 0 ? modules.map(m => (
              <div key={m.id} className="bg-[#2d3448] rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{m.name} <span className="text-sm font-normal text-gray-400">({m.type})</span></h3>
                    <p className="text-xs text-gray-300 mt-1">
                      <span title="Тип нагрузки">🏋️ {m.loadType || 'N/A'}</span> | 
                      <span title="Группа мышц" className="ml-2">💪 {m.muscleGroup || 'N/A'}</span> | 
                      <span title="Сложность" className="ml-2">⭐ {m.complexity}</span> | 
                      <span title="RPE" className="ml-2">🎯 {m.rpeMin}-{m.rpeMax}</span>
                    </p>
                     <p className="text-xs text-gray-400 mt-2">
                      📹 {m.video?.title || 'Без видео'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(m)} className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm">Редакт.</button>
                    <button onClick={() => handleDelete(m.id)} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm">Удалить</button>
                  </div>
                </div>
              </div>
            )) : <p className="text-gray-400">Модули еще не созданы.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTrainingModulesPage;
