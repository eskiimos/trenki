'use client';

import React, { useState, useEffect } from 'react';
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
  Blocks,
  Plus,
  X,
  Save,
  Pencil,
  Trash2,
  Dumbbell,
  Activity,
  Star,
  Target,
  Video as VideoIcon,
  SlidersHorizontal,
  List,
  type LucideIcon,
} from 'lucide-react';

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
    <AdminPage>
      <PageHeader
        title="Тренировочные модули"
        icon={Blocks}
        backHref="/admin"
        actions={
          <AdminButton
            tone={showForm ? 'secondary' : 'primary'}
            icon={showForm ? X : Plus}
            onClick={() => { showForm ? handleCancel() : setShowForm(true) }}
          >
            {showForm ? 'Отмена' : 'Создать модуль'}
          </AdminButton>
        }
      />

      {showForm && (
        <AdminCard style={{ marginBottom: 24 }}>
          <SectionTitle icon={Blocks}>
            {editingModuleId ? 'Редактировать модуль' : 'Новый модуль'}
          </SectionTitle>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Основные поля */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Название *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Тип модуля *</label>
                <select name="type" value={formData.type} onChange={handleChange} required style={{ ...inputStyle, colorScheme: 'dark' }}>
                  {moduleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label style={labelStyle}>Описание</label>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Видео (необязательно)</label>
                <select name="videoId" value={formData.videoId} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }}>
                  <option value="">Без видео</option>
                  {videos.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Порядок</label>
                <input type="number" name="order" value={formData.order} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            {/* Параметры для алгоритма */}
            <fieldset
              style={{
                border: '1px solid var(--border-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <legend
                className="flex items-center gap-2"
                style={{
                  padding: '0 8px',
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-muted)',
                }}
              >
                <SlidersHorizontal size={16} aria-hidden />
                Параметры для алгоритма
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label style={labelStyle}>Тип нагрузки</label>
                  <select name="loadType" value={formData.loadType} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }}>
                    {loadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Группа мышц</label>
                  <select name="muscleGroup" value={formData.muscleGroup} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }}>
                    {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Сложность</label>
                  <select name="complexity" value={formData.complexity} onChange={handleChange} style={{ ...inputStyle, colorScheme: 'dark' }}>
                    {complexities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>RPE Min (1-10)</label>
                  <input type="number" name="rpeMin" value={formData.rpeMin} onChange={handleChange} min="1" max="10" style={{ ...inputStyle, colorScheme: 'dark' }} />
                </div>
                <div>
                  <label style={labelStyle}>RPE Max (1-10)</label>
                  <input type="number" name="rpeMax" value={formData.rpeMax} onChange={handleChange} min="1" max="10" style={{ ...inputStyle, colorScheme: 'dark' }} />
                </div>
              </div>
            </fieldset>

            <div className="flex flex-wrap justify-end gap-3">
              <AdminButton type="button" tone="secondary" icon={X} onClick={handleCancel}>
                Отмена
              </AdminButton>
              <AdminButton type="submit" icon={Save} disabled={isLoading}>
                {isLoading ? 'Сохранение...' : 'Сохранить'}
              </AdminButton>
            </div>
          </form>
        </AdminCard>
      )}

      {/* Список модулей */}
      <AdminCard>
        <SectionTitle icon={List}>Все модули ({modules.length})</SectionTitle>
        {modules.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {modules.map(m => (
              <div
                key={m.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate" style={{ fontSize: 16, fontWeight: 700 }}>
                      {m.name}{' '}
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)' }}>
                        ({m.type})
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
                      <Chip icon={Dumbbell} label="Тип нагрузки" value={m.loadType || '—'} />
                      <Chip icon={Activity} label="Группа мышц" value={m.muscleGroup || '—'} />
                      <Chip icon={Star} label="Сложность" value={m.complexity} />
                      <Chip icon={Target} label="RPE" value={`${m.rpeMin}-${m.rpeMax}`} />
                    </div>
                    <div
                      className="flex items-center gap-2"
                      style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}
                    >
                      <VideoIcon size={16} aria-hidden />
                      <span className="truncate">{m.video?.title || 'Без видео'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <AdminButton
                      size="sm"
                      tone="secondary"
                      icon={Pencil}
                      onClick={() => handleEdit(m)}
                      aria-label="Редактировать модуль"
                    >
                      <span className="hidden sm:inline">Редактировать</span>
                    </AdminButton>
                    <AdminButton
                      size="sm"
                      tone="danger"
                      icon={Trash2}
                      onClick={() => handleDelete(m.id)}
                      aria-label="Удалить модуль"
                    >
                      <span className="hidden sm:inline">Удалить</span>
                    </AdminButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={Blocks} title="Модули ещё не созданы" hint="Нажми «Создать модуль» выше" />
        )}
      </AdminCard>
    </AdminPage>
  );
};

/** Чип мета-данных модуля: иконка + значение, подпись доступна скринридеру. */
function Chip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        fontSize: 12,
        color: 'var(--color-muted)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-hairline)',
        borderRadius: 'var(--radius-pill)',
        padding: '4px 8px',
      }}
    >
      <Icon size={16} aria-hidden />
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

export default AdminTrainingModulesPage;
