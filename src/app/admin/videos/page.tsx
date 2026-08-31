'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import MultiLevelTagFilter from '@/components/MultiLevelTagFilter';
import { AgeGroup, TrainingGoal } from '@/generated/prisma';
import { GOAL_LABELS } from '@/lib/training-algorithm-v3';
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
  Video as VideoIcon, VideoOff, Plus, X, Save, Pencil, Trash2, Eye, EyeOff,
  Bell, BellRing, Upload, CloudUpload, Wand2, RefreshCw, AlertTriangle, Info,
  Check, Settings, Sliders, Target, Users, User, UserRound, Baby, Backpack,
  Dumbbell, Zap, HeartPulse, PersonStanding, Flame, Wind, Gauge, Snowflake,
  Goal, CircleDot, Swords, Hand, Stethoscope, Move, Loader2, Sparkles,
  TrendingUp, Star, type LucideIcon,
} from 'lucide-react';

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
  duration: number;
  durationFormatted?: string;
  videoUrl: string;
  thumbnail?: string;
  trainer: {
    id: string;
    name: string;
  };
  // Мульти-тренер: соавторы (включая ведущего) из /api/videos/all
  coauthors?: {
    id: string;
    name: string;
    lastName: string;
    avatar?: string | null;
  }[];
  category: string;
  difficulty: string;
  tags: string[];
  equipment: string[];
  level?: string;
  isPublished: boolean;
  athletesNotifiedAt?: string | null;
  // Поля для алгоритма LoadType
  типМодуля?: string;
  типНагрузки?: string;
  группаМышц?: string;
  сложность?: string;
  // Поля для алгоритма 2.0 (enum значения)
  moduleType?: string;
  loadType?: string;
  muscleGroup?: string;
  complexity?: string;
  rpeMin?: number | null;
  rpeMax?: number | null;
  // Новые поля для Алгоритма 2.0
  ageGroups?: string[];
  trainingGoals?: string[];
}

// Функция форматирования длительности в YouTube формате (MM:SS или H:MM:SS)
const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/* ─── Иконки вместо эмодзи ──────────────────────────────────────────────── */

/** Характеристика атлета → иконка (раньше здесь были эмодзи). */
const CHAR_ICON: Record<string, LucideIcon> = {
  'Сила': Dumbbell,
  'Скорость': Zap,
  'Выносливость': HeartPulse,
  'Техника': Target,
  'Гибкость': PersonStanding,
};

/** Тип нагрузки → что развивает (бейдж в шапке формы). */
const LOAD_TYPE_DEVELOPS: Record<string, { icon: LucideIcon; label: string }> = {
  MAX_STRENGTH: { icon: Dumbbell, label: 'Силу' },
  POWER: { icon: Dumbbell, label: 'Силу' },
  SPEED: { icon: Zap, label: 'Скорость' },
  STRENGTH_ENDURANCE: { icon: HeartPulse, label: 'Выносливость' },
  ANAEROBIC_ENDURANCE: { icon: HeartPulse, label: 'Выносливость' },
  AEROBIC_ENDURANCE: { icon: HeartPulse, label: 'Выносливость' },
  AGILITY: { icon: Target, label: 'Технику' },
  MOBILITY: { icon: PersonStanding, label: 'Гибкость' },
  TECHNICAL_SKILL: { icon: Target, label: 'Технику' },
  STATIC_STRETCH: { icon: PersonStanding, label: 'Гибкость' },
  DYNAMIC_STRETCH: { icon: PersonStanding, label: 'Гибкость' },
  PREHAB: { icon: PersonStanding, label: 'Гибкость' },
};

/** Тип модуля → иконка бейджа в карточке списка. */
const MODULE_TYPE_ICON: Record<string, LucideIcon> = {
  'Разминка': Flame,
  'ОФП': Dumbbell,
  'Техника': Target,
  'Заминка': Wind,
};

/** Цель тренировки → иконка (эмодзи из GOAL_LABELS больше не рендерим). */
const GOAL_ICON: Record<string, LucideIcon> = {
  POWERFUL_SHOT: Target,
  OUTRUN_OPPONENT: Zap,
  STRENGTH_STABILITY: Dumbbell,
  SOFT_HANDS: Hand,
  FULL_GAME_ENDURANCE: HeartPulse,
  AGILITY: Move,
  SPORT_LONGEVITY: Stethoscope,
};

const AGE_GROUP_ICON: Record<string, LucideIcon> = {
  CHILD: Baby,
  TEEN: Backpack,
  YOUNG_ADULT: User,
  ADULT: UserRound,
};

const SPORT_ICON: Record<string, LucideIcon> = {
  HOCKEY: Snowflake,
  FOOTBALL: Goal,
  BASKETBALL: CircleDot,
  BOXING: Swords,
};

/* ─── Локальные примитивы вёрстки (стили из токенов, без логики) ────────── */

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--color-muted)',
  margin: '6px 0 0',
};

/** Подсказка секции (была строка с эмодзи-лампочкой). */
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2"
      style={{ marginBottom: 16, fontSize: 12, color: 'var(--color-muted)' }}
    >
      <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Секция формы вместо fieldset с цветовым кодированием (blue/purple/green). */
function FormSection({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AdminCard style={{ borderRadius: 'var(--radius-lg)' }}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {children}
    </AdminCard>
  );
}

/** Единый переключатель вкладок: один активный цвет на всю страницу. */
function TabButton({
  active,
  icon: Icon,
  onClick,
  children,
  className = '',
}: {
  active: boolean;
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center justify-center gap-2 transition-colors ${className}`}
      style={{
        minHeight: 44,
        padding: '10px 16px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        background: active ? 'var(--color-brand)' : 'transparent',
        color: active ? 'var(--color-night)' : 'var(--color-muted)',
        border: `1px solid ${active ? 'var(--color-brand)' : 'var(--border-hairline)'}`,
      }}
    >
      <Icon size={20} aria-hidden />
      {children}
    </button>
  );
}

/** Чекбокс с видимой галочкой: глобальный appearance:none гасит нативную. */
function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: 20, height: 20 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
        style={{ width: 20, height: 20, margin: 0 }}
      />
      <span
        aria-hidden
        className="pointer-events-none flex items-center justify-center"
        style={{
          width: 20,
          height: 20,
          borderRadius: 'var(--radius-sm)',
          background: checked ? 'var(--color-brand)' : 'var(--color-night)',
          border: `1px solid ${checked ? 'var(--color-brand)' : 'var(--border-hairline)'}`,
        }}
      >
        {checked && <Check size={14} strokeWidth={3} style={{ color: 'var(--color-night)' }} />}
      </span>
    </span>
  );
}

/** Строка выбора «чекбокс + иконка + подпись», тач-таргет 44px. */
function CheckRow({
  checked,
  onChange,
  icon: Icon,
  children,
}: {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <label
      className="flex items-center gap-3 cursor-pointer transition-colors hover:brightness-125"
      style={{ minHeight: 44, padding: 8, borderRadius: 'var(--radius-sm)' }}
    >
      <Checkbox checked={checked} onChange={onChange} />
      {Icon && (
        <Icon size={20} style={{ color: 'var(--color-muted)', flexShrink: 0 }} aria-hidden />
      )}
      <span style={{ fontSize: 14 }}>{children}</span>
    </label>
  );
}

/** Один прогресс-бар на обе загрузки (были зелёный и синий). */
function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 4 }}>
        {label}: {value}%
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(174,171,187,0.20)',
        }}
      >
        <div
          className="transition-all"
          style={{
            width: `${value}%`,
            height: 8,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-brand)',
          }}
        />
      </div>
    </div>
  );
}

/** Кнопка-загрузка на <label> (скрытый input рядом) — единый вид и 44px. */
const uploadLabelStyle = (
  disabled: boolean,
  tone: 'primary' | 'secondary' = 'secondary'
): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  minHeight: 44,
  padding: '10px 20px',
  borderRadius: 'var(--radius-pill)',
  fontSize: 14,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  background: tone === 'primary' ? 'var(--color-brand)' : 'transparent',
  color: tone === 'primary' ? 'var(--color-night)' : 'var(--color-ink)',
  border: tone === 'primary' ? 'none' : '1px solid var(--border-hairline)',
});

/** Единый маркер обязательного поля (были «*» и жёлтая звезда). */
function Req() {
  return <span style={{ color: 'var(--color-danger)' }}> *</span>;
}

const AdminVideosPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Состояния списка разведены: пока грузим — скелетон, а не «Видео пока нет».
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]); // ID тегов из базы
  const [activeTab, setActiveTab] = useState<'basic' | 'algorithm'>('basic');
  const [algorithmSubTab, setAlgorithmSubTab] = useState<'classification' | 'targeting'>('classification');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [s3UploadProgress, setS3UploadProgress] = useState<number | null>(null);

  const getMissingAlgorithmFields = (video: Video) => {
    const missing: string[] = [];
    const moduleTypeValue = (video as any).moduleType || video.типМодуля;
    const loadTypeValue = (video as any).loadType || video.типНагрузки;
    const muscleGroupValue = (video as any).muscleGroup || video.группаМышц;
    const complexityValue = (video as any).complexity || video.сложность;

    if (!moduleTypeValue) missing.push('тип модуля');
    if (!loadTypeValue) missing.push('тип нагрузки');
    if (!muscleGroupValue) missing.push('группа мышц');
    if (!complexityValue) missing.push('сложность');
    if (video.rpeMin == null) missing.push('RPE min');
    if (video.rpeMax == null) missing.push('RPE max');
    if (!video.ageGroups || video.ageGroups.length === 0) missing.push('возраст');
    if (!video.trainingGoals || video.trainingGoals.length === 0) missing.push('цели');

    return missing;
  };
  
    // Начальное состояние формы
  const initialFormState = {
    title: '',
    description: '',
    videoUrl: '',
    thumbnail: '',
    category: 'SKATING',
    difficulty: 'BEGINNER',
    trainerId: '',
    coauthorIds: [] as string[], // мульти-тренер: доп. соавторы (без ведущего)
    tags: '', // Оставляем для обратной совместимости (старые текстовые теги)
    equipment: '',
    duration: 0, // Длительность в секундах (из Kinescope)
    // Поля для алгоритма тренировок (LoadType-based)
    типМодуля: '',
    типНагрузки: '', // Основное поле - создаёт LoadType тег автоматически
    группаМышц: '',
    сложность: '',
    rpeMin: '',
    rpeMax: '',
    // Новые поля для Алгоритма 2.0
    ageGroups: [] as string[],
    trainingGoals: [] as string[],
    audience: 'HOCKEY',
    // СФП: подходит не только хоккею → список видов спорта
    isSfp: false,
    sports: [] as string[],
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
      setListError(false);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setListError(true);
    } finally {
      setIsListLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Старые текстовые теги (для обратной совместимости)
      const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      const equipmentArray = formData.equipment.split(',').map(eq => eq.trim()).filter(eq => eq);

      // Маппинг кириллических полей на латиницу для API
      const payload = {
        title: formData.title,
        description: formData.description,
        videoUrl: formData.videoUrl,
        thumbnail: formData.thumbnail,
        category: formData.category,
        difficulty: formData.difficulty,
        trainerId: formData.trainerId,
        // Мульти-тренер: ведущий + соавторы (дедуп, ведущий первым).
        trainerIds: Array.from(
          new Set([formData.trainerId, ...formData.coauthorIds].filter(Boolean))
        ),
        tags: tagsArray,
        equipment: equipmentArray,
        isPublished: true,
        duration: formData.duration, // Длительность в секундах
        // Маппинг полей для алгоритма (кириллица → латиница)
        moduleType: formData.типМодуля,
        loadType: formData.типНагрузки,
        muscleGroup: formData.группаМышц,
        complexity: formData.сложность,
        rpeMin: formData.rpeMin ? parseInt(formData.rpeMin) : null,
        rpeMax: formData.rpeMax ? parseInt(formData.rpeMax) : null,
        // Новые поля для Алгоритма 2.0
        ageGroups: formData.ageGroups,
        trainingGoals: formData.trainingGoals,
        audience: formData.audience,
        isSfp: formData.isSfp,
        sports: formData.isSfp ? formData.sports : [],
      };

      console.log('Sending payload:', payload);
      console.log('Form data типНагрузки:', formData.типНагрузки);

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
          
          // Умный парсинг названия для автозаполнения полей алгоритма
          const parsedData = parseVideoTitle(data.title);
          if (Object.keys(parsedData).length > 0) {
            Object.assign(updates, parsedData);
            if (parsedData.типНагрузки) updatedFields.push('тип нагрузки');
            if (parsedData.группаМышц) updatedFields.push('группа мышц');
            if (parsedData.сложность) updatedFields.push('сложность');
            if (parsedData.rpeMin) updatedFields.push('RPE');
          }
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
          
          alert(`Метаданные успешно получены!\n\nОбновлено: ${updatedFields.join(', ')}`);
        } else {
          alert('Все данные уже заполнены или не найдены');
        }
      } else {
        console.error('Kinescope API error:', data);
        let errorMessage = 'Ошибка при получении метаданных';
        
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

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const videoName = file.name.replace(/\.[^/.]+$/, ''); // имя без расширения

    try {
      setUploadProgress(0);

      // Шаг 1: получаем URL для загрузки от нашего сервера
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

      // Шаг 2: загружаем файл напрямую на Kinescope через XHR (чтобы отслеживать прогресс)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      // Шаг 3: сохраняем URL и автоматически получаем метаданные
      const kinescopeUrl = `https://kinescope.io/${videoId}`;
      setFormData(prev => ({ ...prev, videoUrl: kinescopeUrl }));
      setUploadProgress(null);

      // Авто-загрузка метаданных (превью, длительность)
      try {
        const metaRes = await fetch('/api/kinescope/metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: kinescopeUrl }),
        });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          setFormData(prev => ({
            ...prev,
            title: prev.title || meta.title || videoName,
            thumbnail: prev.thumbnail || meta.thumbnail || '',
            duration: meta.duration || prev.duration,
          }));
        }
      } catch {
        // метаданные ещё могут не быть готовы сразу после загрузки
      }

      alert('Видео успешно загружено');
    } catch (error: any) {
      console.error('Video upload error:', error);
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadProgress(null);
    }

    // Сбрасываем input
    e.target.value = '';
  };

  // Загрузка видеофайла в собственное S3-хранилище (reg.ru): получаем presigned
  // PUT у нашего сервера и грузим файл напрямую в бакет через XHR (с прогрессом).
  // В поле videoUrl пишется внутренний URL вида s3://videos/<id>.mp4 — плеер
  // получит подписанную ссылку от API при просмотре.
  // Общая загрузка в S3: kind=video → приватный файл, s3:// в поле videoUrl;
  // kind=thumbnail → публичное превью (x-amz-acl из подписи), https в thumbnail.
  const uploadToS3 = async (file: File, kind: 'video' | 'thumbnail') => {
    const contentType = file.type || (kind === 'thumbnail' ? 'image/jpeg' : 'video/mp4');

    try {
      setS3UploadProgress(0);

      // Шаг 1: presigned PUT от нашего сервера (fileSize — для проверки на
      // сырой исходник: транскодинга нет, что залито — то и раздаётся)
      const initRes = await fetch('/api/admin/s3/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType, kind, fileSize: file.size }),
      });
      const init = await initRes.json().catch(() => ({}));
      if (!initRes.ok) {
        alert(`Ошибка подготовки загрузки: ${init.error || `HTTP ${initRes.status}`}`);
        setS3UploadProgress(null);
        return;
      }
      const { uploadUrl, videoUrl, acl } = init;

      // Шаг 2: PUT напрямую в S3. Content-Type (и x-amz-acl для превью) обязаны
      // совпадать с подписанными, иначе S3 ответит 403.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        if (acl) xhr.setRequestHeader('x-amz-acl', acl);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setS3UploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      // Шаг 3: записываем URL в нужное поле формы
      if (kind === 'thumbnail') {
        setFormData(prev => ({ ...prev, thumbnail: videoUrl }));
      } else {
        setFormData(prev => ({ ...prev, videoUrl }));
      }
      setS3UploadProgress(null);
      alert(kind === 'thumbnail' ? 'Превью загружено в хранилище' : 'Файл загружен в хранилище');
    } catch (error: any) {
      console.error('S3 upload error:', error);
      alert(`Ошибка загрузки в хранилище: ${error.message}`);
      setS3UploadProgress(null);
    }
  };

  const handleS3FileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadToS3(file, 'video');
    e.target.value = '';
  };

  const handleS3ThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadToS3(file, 'thumbnail');
    e.target.value = '';
  };

    const handleEditVideo = async (video: Video) => {
    setEditingVideoId(video.id);
    
    // Обратный маппинг enum → русские названия для формы
    const moduleTypeToRussian: Record<string, string> = {
      'WARMUP': 'Разминка',
      'FITNESS': 'ОФП',
      'TECHNIQUE': 'Техника',
      'COOLDOWN': 'Заминка',
    };
    
    const complexityToRussian: Record<string, string> = {
      'BEGINNER': 'Новичок',
      'AMATEUR': 'Любитель',
      'ADVANCED': 'Продвинутый',
      'PRO': 'Профи',
    };
    
    const muscleGroupToRussian: Record<string, string> = {
      'FULL_BODY': 'Все тело',
      'LOWER_BODY': 'Низ тела',
      'UPPER_PULL': 'Верх тяга',
      'UPPER_PUSH': 'Верх жим',
      'CORE_STABILITY': 'Кор стабилизация',
      'CORE_DYNAMICS': 'Кор динамика',
      'PREHAB_SHOULDER': 'ЛФК плечо',
      'PREHAB_KNEE': 'ЛФК колено',
      'PREHAB_BACK': 'ЛФК спина',
    };
    
    const moduleTypeValue = (video as any).moduleType || '';
    const complexityValue = (video as any).complexity || '';
    const muscleGroupValue = (video as any).muscleGroup || '';
    
    setFormData({
      title: video.title,
      description: video.description || '',
      videoUrl: video.videoUrl,
      thumbnail: video.thumbnail || '',
      category: video.category,
      difficulty: video.difficulty,
      trainerId: video.trainer.id,
      // Мульти-тренер: соавторы без ведущего (ведущий выбирается в trainerId).
      coauthorIds: ((video as any).coauthors || [])
        .map((c: { id: string }) => c.id)
        .filter((cid: string) => cid !== video.trainer.id),
      tags: video.tags.join(', '), // Старые текстовые теги
      equipment: video.equipment.join(', '),
      duration: video.duration || 0, // Длительность в секундах
      // Поля для алгоритма - маппинг enum обратно в русские названия для формы
      типМодуля: moduleTypeToRussian[moduleTypeValue] || moduleTypeValue || '',
      типНагрузки: (video as any).loadType || video.типНагрузки || '', // LoadType приходит уже в нужном формате
      группаМышц: muscleGroupToRussian[muscleGroupValue] || muscleGroupValue || '',
      сложность: complexityToRussian[complexityValue] || complexityValue || '',
      rpeMin: (video as any).rpeMin?.toString() || '',
      rpeMax: (video as any).rpeMax?.toString() || '',
      // Новые поля для Алгоритма 2.0
      ageGroups: (video as any).ageGroups || [],
      trainingGoals: (video as any).trainingGoals || [],
      audience: (video as any).audience || 'HOCKEY',
      isSfp: Boolean((video as any).isSfp),
      sports: (video as any).sports || [],
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
    
    setActiveTab('basic'); // Всегда начинаем с первой вкладки
    setAlgorithmSubTab('classification'); // И с первой подвкладки
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingVideoId(null);
    setShowForm(false);
    setSelectedTagIds([]); // Очищаем выбранные теги
    setActiveTab('basic'); // Сбрасываем на первую вкладку
    setAlgorithmSubTab('classification'); // И подвкладку тоже
    setFormData({
      ...initialFormState,
      trainerId: trainers[0]?.id || '',
    });
  };

  // Умный парсинг названия видео для автозаполнения полей
  const parseVideoTitle = (title: string) => {
    console.log('Parsing video title:', title);
    const parsed: any = {};
    const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е');
    const normalizedTitle = normalize(title);
    const tokens = normalizedTitle
      .split(/[+|/•,]|\s+-\s+|\s*—\s*|\s*–\s*|\s*\|\s*/g)
      .map((token) => token.trim())
      .filter(Boolean);

    const loadTypeMap: Record<string, string> = {
      'максимальная сила': 'MAX_STRENGTH',
      'сила': 'MAX_STRENGTH',
      'мощность': 'POWER',
      'скорость': 'SPEED',
      'силовая выносливость': 'STRENGTH_ENDURANCE',
      'анаэробная выносливость': 'ANAEROBIC_ENDURANCE',
      'аэробная выносливость': 'AEROBIC_ENDURANCE',
      'выносливость': 'AEROBIC_ENDURANCE',
      'ловкость': 'AGILITY',
      'маневренность': 'AGILITY',
      'мобильность': 'MOBILITY',
      'гибкость': 'MOBILITY',
      'техника': 'TECHNICAL_SKILL',
      'технические навыки': 'TECHNICAL_SKILL',
      'статическая растяжка': 'STATIC_STRETCH',
      'растяжка': 'STATIC_STRETCH',
      'динамическая растяжка': 'DYNAMIC_STRETCH',
      'лфк': 'PREHAB',
      'реабилитация': 'PREHAB',
      'кроссфит': 'POWER',
      'hiit': 'POWER',
      'интервальная': 'POWER',
    };

    const muscleGroupMap: Record<string, string> = {
      'все тело': 'Все тело',
      'всё тело': 'Все тело',
      'низ тела': 'Низ тела',
      'низ': 'Низ тела',
      'ноги': 'Низ тела',
      'бедра': 'Низ тела',
      'верх тела': 'Верх тяга',
      'верх': 'Верх тяга',
      'верх тяга': 'Верх тяга',
      'верх жим': 'Верх жим',
      'грудь': 'Верх жим',
      'спина': 'Верх тяга',
      'кор': 'Кор стабилизация',
      'кор стабилизация': 'Кор стабилизация',
      'кор динамика': 'Кор динамика',
      'плечо': 'ЛФК плечо',
      'колено': 'ЛФК колено',
      'спина лфк': 'ЛФК спина',
      'голеностоп': 'ЛФК колено',
      'тазобедренный': 'ЛФК колено',
    };

    const complexityMap: Record<string, string> = {
      'новичок': 'Новичок',
      'начинающий': 'Новичок',
      'beginner': 'Новичок',
      'любитель': 'Любитель',
      'amateur': 'Любитель',
      'продвинутый': 'Продвинутый',
      'advanced': 'Продвинутый',
      'профи': 'Профи',
      'про': 'Профи',
      'pro': 'Профи',
      'elite': 'Профи',
    };

    const categoryMap: Array<[RegExp, string]> = [
      [/катание|скольж|skating/i, 'SKATING'],
      [/бросок|броски|shoot|shot|щелчок|слэп/i, 'SHOOTING'],
      [/пас|передач|passing/i, 'PASSING'],
      [/единоборств|борьб|checking|контакт/i, 'CHECKING'],
      [/вратар|goalie|goalkeeper/i, 'GOALKEEPER'],
      [/большинство|power play|powerplay/i, 'POWER_PLAY'],
      [/меньшинство|penalty kill|pk/i, 'PENALTY_KILL'],
      [/тактик|tactic|strategy/i, 'TACTICAL'],
      [/техника|handling|skill/i, 'TECHNIQUE'],
      [/сила|strength|max strength/i, 'STRENGTH'],
      [/выносливость|endurance/i, 'ENDURANCE'],
      [/скорость|speed/i, 'SPEED'],
    ];

    const difficultyMap: Record<string, string> = {
      'новичок': 'BEGINNER',
      'начинающий': 'BEGINNER',
      'beginner': 'BEGINNER',
      'любитель': 'INTERMEDIATE',
      'amateur': 'INTERMEDIATE',
      'продвинутый': 'ADVANCED',
      'advanced': 'ADVANCED',
      'профи': 'EXPERT',
      'про': 'EXPERT',
      'pro': 'EXPERT',
      'elite': 'EXPERT',
    };

    const moduleTypeMap: Record<string, string> = {
      'разминка': 'Разминка',
      'warmup': 'Разминка',
      'офп': 'ОФП',
      'физ подготовка': 'ОФП',
      'физическая подготовка': 'ОФП',
      'fitness': 'ОФП',
      'техника': 'Техника',
      'technique': 'Техника',
      'заминка': 'Заминка',
      'cooldown': 'Заминка',
      'stretch': 'Заминка',
    };

    const goalMap: Array<[RegExp, TrainingGoal]> = [
      [/мощн(ый|ая)|бросок|слэп|щелчок|shot/i, TrainingGoal.POWERFUL_SHOT],
      [/убегаем|скорост(ь|ная смена)|спринт|рывок|оппонент/i, TrainingGoal.OUTRUN_OPPONENT],
      [/силов(ая|ой) борьба|устойчивост(ь|и)|контакт|столкнов/i, TrainingGoal.STRENGTH_STABILITY],
      [/мягк(ие|ие) ручк|плеймейкер|контроль клюшки|handling/i, TrainingGoal.SOFT_HANDS],
      [/выносливост(ь|и) на всю игру|эндьюранс|endurance|длительн/i, TrainingGoal.FULL_GAME_ENDURANCE],
      [/маневренност(ь|и)|агилит|agility|смена направления/i, TrainingGoal.AGILITY],
      [/долголетие|восстановлени|профилактик|prehab|rehab|mobility/i, TrainingGoal.SPORT_LONGEVITY],
    ];

    const ageGroupMap: Array<[RegExp, string]> = [
      [/дети|детск|u10|u11|u12|7-10/i, 'CHILD'],
      [/подрост|юниор|u13|u14|u15|u16|u17|11-17/i, 'TEEN'],
      [/молод(ые|ежь)|18-34|18-35|adult 18/i, 'YOUNG_ADULT'],
      [/взросл|ветеран|мастерс|35\+|36\+|40\+/i, 'ADULT'],
    ];

    const findByMap = (map: Record<string, string>) => {
      for (const token of tokens) {
        for (const [key, value] of Object.entries(map)) {
          if (token.includes(key)) {
            return value;
          }
        }
      }
      return null;
    };

    const moduleType = findByMap(moduleTypeMap);
    if (moduleType) {
      parsed.типМодуля = moduleType;
      console.log('Found moduleType:', moduleType);
    }

    const loadType = findByMap(loadTypeMap);
    if (loadType) {
      parsed.типНагрузки = loadType;
      console.log('Found loadType:', loadType);
    }

    const muscleGroup = findByMap(muscleGroupMap);
    if (muscleGroup) {
      parsed.группаМышц = muscleGroup;
      console.log('Found muscleGroup:', muscleGroup);
    }

    for (const [key, value] of Object.entries(complexityMap)) {
      if (normalizedTitle.includes(key)) {
        parsed.сложность = value;
        console.log('Found complexity:', value);
        break;
      }
    }

    for (const [regex, category] of categoryMap) {
      if (regex.test(normalizedTitle)) {
        parsed.category = category;
        console.log('Found category:', category);
        break;
      }
    }

    for (const [key, value] of Object.entries(difficultyMap)) {
      if (normalizedTitle.includes(key)) {
        parsed.difficulty = value;
        console.log('Found difficulty:', value);
        break;
      }
    }

    const rpeRangeMatch = normalizedTitle.match(/rpe\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})/i);
    if (rpeRangeMatch) {
      const min = Math.max(1, parseInt(rpeRangeMatch[1]));
      const max = Math.min(10, parseInt(rpeRangeMatch[2]));
      parsed.rpeMin = Math.min(min, max).toString();
      parsed.rpeMax = Math.max(min, max).toString();
      console.log('Found RPE range:', parsed.rpeMin, '-', parsed.rpeMax);
    } else {
      const rpeSingleMatch = normalizedTitle.match(/rpe\s*(\d{1,2})/i);
      if (rpeSingleMatch) {
        const rpe = parseInt(rpeSingleMatch[1]);
        parsed.rpeMin = Math.max(1, rpe - 1).toString();
        parsed.rpeMax = Math.min(10, rpe + 1).toString();
        console.log('Found RPE:', rpe, '→ range:', parsed.rpeMin, '-', parsed.rpeMax);
      }
    }

    const goalMatches = new Set<string>();
    for (const [regex, goal] of goalMap) {
      if (regex.test(normalizedTitle)) {
        goalMatches.add(goal);
      }
    }
    if (goalMatches.size > 0) {
      parsed.trainingGoals = Array.from(goalMatches);
      console.log('Found goals:', parsed.trainingGoals);
    }

    const ageMatches = new Set<string>();
    for (const [regex, group] of ageGroupMap) {
      if (regex.test(normalizedTitle)) {
        ageMatches.add(group);
      }
    }
    if (ageMatches.size > 0) {
      parsed.ageGroups = Array.from(ageMatches);
      console.log('Found age groups:', parsed.ageGroups);
    }

    if (!parsed.типНагрузки && parsed.типМодуля === 'Разминка') {
      parsed.типНагрузки = 'DYNAMIC_STRETCH';
    }
    if (!parsed.типНагрузки && parsed.типМодуля === 'Заминка') {
      parsed.типНагрузки = 'STATIC_STRETCH';
    }
    if (!parsed.типНагрузки && parsed.типМодуля === 'Техника') {
      parsed.типНагрузки = 'TECHNICAL_SKILL';
    }
    if (!parsed.типМодуля && parsed.типНагрузки) {
      const loadTypeToModule: Record<string, string> = {
        STATIC_STRETCH: 'Заминка',
        PREHAB: 'Заминка',
        MOBILITY: 'Заминка',
        DYNAMIC_STRETCH: 'Разминка',
        TECHNICAL_SKILL: 'Техника',
      };
      parsed.типМодуля = loadTypeToModule[parsed.типНагрузки] || 'ОФП';
    }

    if (!parsed.category && parsed.типНагрузки) {
      const loadTypeToCategory: Record<string, string> = {
        POWER: 'STRENGTH',
        MAX_STRENGTH: 'STRENGTH',
        STRENGTH_ENDURANCE: 'ENDURANCE',
        ANAEROBIC_ENDURANCE: 'ENDURANCE',
        AEROBIC_ENDURANCE: 'ENDURANCE',
        SPEED: 'SPEED',
        AGILITY: 'TECHNIQUE',
        TECHNICAL_SKILL: 'TECHNIQUE',
        MOBILITY: 'GENERAL',
        PREHAB: 'GENERAL',
        STATIC_STRETCH: 'GENERAL',
        DYNAMIC_STRETCH: 'GENERAL',
      };
      parsed.category = loadTypeToCategory[parsed.типНагрузки] || 'GENERAL';
    }

    if (!parsed.difficulty && parsed.сложность) {
      const complexityToDifficulty: Record<string, string> = {
        'Новичок': 'BEGINNER',
        'Любитель': 'INTERMEDIATE',
        'Продвинутый': 'ADVANCED',
        'Профи': 'EXPERT',
      };
      parsed.difficulty = complexityToDifficulty[parsed.сложность] || parsed.difficulty;
    }

    if (!parsed.trainingGoals && parsed.типНагрузки) {
      const inferredGoals = new Set<string>();
      const loadTypeGoalMap: Record<string, TrainingGoal> = {
        POWER: TrainingGoal.POWERFUL_SHOT,
        MAX_STRENGTH: TrainingGoal.STRENGTH_STABILITY,
        SPEED: TrainingGoal.OUTRUN_OPPONENT,
        AGILITY: TrainingGoal.AGILITY,
        ANAEROBIC_ENDURANCE: TrainingGoal.FULL_GAME_ENDURANCE,
        AEROBIC_ENDURANCE: TrainingGoal.FULL_GAME_ENDURANCE,
        STRENGTH_ENDURANCE: TrainingGoal.FULL_GAME_ENDURANCE,
        MOBILITY: TrainingGoal.SPORT_LONGEVITY,
        PREHAB: TrainingGoal.SPORT_LONGEVITY,
        STATIC_STRETCH: TrainingGoal.SPORT_LONGEVITY,
        DYNAMIC_STRETCH: TrainingGoal.SPORT_LONGEVITY,
        TECHNICAL_SKILL: TrainingGoal.SOFT_HANDS,
      };

      const inferredGoal = loadTypeGoalMap[parsed.типНагрузки];
      if (inferredGoal) inferredGoals.add(inferredGoal);

      if (parsed.типНагрузки === 'AGILITY' && parsed.типМодуля === 'Техника') {
        inferredGoals.add(TrainingGoal.SOFT_HANDS);
      }
      if (parsed.типНагрузки === 'POWER' && parsed.типМодуля === 'ОФП') {
        inferredGoals.add(TrainingGoal.POWERFUL_SHOT);
      }
      if (parsed.типНагрузки === 'MAX_STRENGTH') {
        inferredGoals.add(TrainingGoal.STRENGTH_STABILITY);
      }

      if (inferredGoals.size > 0) {
        parsed.trainingGoals = Array.from(inferredGoals);
        console.log('Inferred goals:', parsed.trainingGoals);
      }
    }

    if (!parsed.ageGroups) {
      const ageDefaults: string[] = ['CHILD', 'TEEN', 'YOUNG_ADULT', 'ADULT'];

      if (parsed.типНагрузки === 'POWER' || parsed.типНагрузки === 'MAX_STRENGTH') {
        parsed.ageGroups = ['TEEN', 'YOUNG_ADULT', 'ADULT'];
      } else if (parsed.типНагрузки === 'PREHAB' || parsed.типНагрузки === 'MOBILITY' || parsed.типНагрузки === 'STATIC_STRETCH') {
        parsed.ageGroups = ['TEEN', 'YOUNG_ADULT', 'ADULT'];
      } else if (parsed.типМодуля === 'Разминка' || parsed.типМодуля === 'Техника') {
        parsed.ageGroups = ageDefaults;
      } else {
        parsed.ageGroups = ageDefaults;
      }

      console.log('Inferred age groups:', parsed.ageGroups);
    }

    if (!parsed.rpeMin && !parsed.rpeMax) {
      const complexityBoost = (() => {
        switch (parsed.сложность) {
          case 'Новичок':
            return -1;
          case 'Любитель':
            return 0;
          case 'Продвинутый':
            return 1;
          case 'Профи':
            return 2;
          default:
            return 0;
        }
      })();

      const baseRange = (() => {
        if (parsed.типМодуля === 'Заминка') return { min: 1, max: 3 };
        if (parsed.типМодуля === 'Разминка') return { min: 2, max: 5 };
        if (parsed.типМодуля === 'Техника') return { min: 3, max: 6 };

        switch (parsed.типНагрузки) {
          case 'MAX_STRENGTH':
          case 'POWER':
            return { min: 6, max: 9 };
          case 'SPEED':
            return { min: 5, max: 8 };
          case 'ANAEROBIC_ENDURANCE':
          case 'AEROBIC_ENDURANCE':
          case 'STRENGTH_ENDURANCE':
            return { min: 4, max: 8 };
          case 'AGILITY':
            return { min: 4, max: 7 };
          case 'MOBILITY':
          case 'PREHAB':
            return { min: 2, max: 5 };
          case 'STATIC_STRETCH':
          case 'DYNAMIC_STRETCH':
            return { min: 1, max: 4 };
          case 'TECHNICAL_SKILL':
            return { min: 3, max: 6 };
          default:
            return { min: 4, max: 7 };
        }
      })();

      const inferredMin = Math.max(1, baseRange.min + complexityBoost);
      const inferredMax = Math.min(10, baseRange.max + complexityBoost);
      parsed.rpeMin = Math.min(inferredMin, inferredMax).toString();
      parsed.rpeMax = Math.max(inferredMin, inferredMax).toString();
      console.log('Inferred RPE:', parsed.rpeMin, '-', parsed.rpeMax);
    }

    console.log('Parsed data:', parsed);
    return parsed;
  };

  const normalizeTitleForCompare = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();

  // Рассылка push «доступно новое видео» всем атлетам (правка владельца).
  const handleNotifyAthletes = async (video: Video) => {
    const already = !!video.athletesNotifiedAt;
    const msg = already
      ? `Уведомление по «${video.title}» уже отправлялось. Отправить ещё раз?`
      : `Отправить push «Новое видео-занятие» всем атлетам?\n\n«${video.title}»`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/videos/${video.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: already }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Не удалось отправить уведомление');
        return;
      }
      alert(`Отправлено: ${data.recipients ?? 0} атлетам (${data.subscriptions ?? 0} устройств)`);
      fetchVideos();
    } catch {
      alert('Ошибка сети при отправке уведомления');
    }
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
    <AdminPage>
      <PageHeader
        title="Управление видео"
        icon={VideoIcon}
        backHref="/admin"
        backLabel="Назад в админ-панель"
        actions={
          <AdminButton
            type="button"
            tone={showForm ? 'secondary' : 'primary'}
            icon={showForm ? X : Plus}
            onClick={() => {
              if (showForm && editingVideoId) {
                handleCancelEdit();
              } else if (!showForm) {
                // Открываем форму для нового видео
                setFormData({
                  ...initialFormState,
                  trainerId: trainers[0]?.id || '',
                });
                setActiveTab('basic');
                setAlgorithmSubTab('classification');
                setShowForm(true);
              } else {
                // Закрываем форму
                setShowForm(false);
                handleCancelEdit();
              }
            }}
          >
            {showForm ? 'Отмена' : 'Добавить видео'}
          </AdminButton>
        }
      />

      {/* Форма добавления/редактирования видео */}
      {showForm && (
        <AdminCard style={{ borderRadius: 'var(--radius-lg)', marginBottom: 24 }}>
          <div
            className="flex flex-wrap items-start justify-between gap-3"
            style={{ marginBottom: 16 }}
          >
            <div className="min-w-0">
              <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {editingVideoId ? 'Редактировать видео' : 'Новое видео'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>
                LoadType теги создаются автоматически на основе «Типа физической нагрузки»
              </p>
            </div>
            {/* Бейдж «Развивает» — виден и на планшете/мобиле (был hidden md:block) */}
            {formData.типНагрузки && (() => {
              const dev = LOAD_TYPE_DEVELOPS[formData.типНагрузки] ?? {
                icon: Target,
                label: '—',
              };
              const DevIcon = dev.icon;
              return (
                <div
                  className="flex items-center gap-3 shrink-0"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--grad-accent)',
                    border: '1px solid var(--border-lime)',
                  }}
                >
                  <DevIcon size={20} style={{ color: 'var(--color-brand)' }} aria-hidden />
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-muted)',
                      }}
                    >
                      Развивает
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{dev.label}</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">

              {/* Табы */}
              <div className="flex flex-wrap gap-2">
                <TabButton
                  active={activeTab === 'basic'}
                  icon={VideoIcon}
                  onClick={() => setActiveTab('basic')}
                >
                  Основное
                </TabButton>
                <TabButton
                  active={activeTab === 'algorithm'}
                  icon={Settings}
                  onClick={() => setActiveTab('algorithm')}
                >
                  Алгоритм 2.0
                </TabButton>
              </div>

              {/* Вкладка: Основное */}
              {activeTab === 'basic' && (
              <FormSection icon={VideoIcon} title="Основная информация">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Название */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Название<Req /></label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        placeholder="Например: Ловкость+низ тела+продвинутый.RPE8"
                        style={{ ...inputStyle, width: 'auto', flex: '1 1 240px', minWidth: 0 }}
                      />
                      {formData.title && (
                        <AdminButton
                          type="button"
                          tone="secondary"
                          icon={Wand2}
                          onClick={() => {
                            const normalizedInput = normalizeTitleForCompare(formData.title);
                            const duplicate = videos.find((video) =>
                              normalizeTitleForCompare(video.title) === normalizedInput
                            );
                            if (duplicate && duplicate.id !== editingVideoId) {
                              const proceed = confirm(
                                `Видео с таким названием уже существует:\n${duplicate.title}\n\nПродолжить автозаполнение?`
                              );
                              if (!proceed) {
                                return;
                              }
                            }
                            const parsed = parseVideoTitle(formData.title);
                            if (Object.keys(parsed).length > 0) {
                              setFormData(prev => ({ ...prev, ...parsed }));
                              const fields = [];
                              if (parsed.типНагрузки) fields.push('тип нагрузки');
                              if (parsed.группаМышц) fields.push('группа мышц');
                              if (parsed.сложность) fields.push('сложность');
                              if (parsed.rpeMin) fields.push('RPE');
                              alert(`Название распознано!\n\nЗаполнено: ${fields.join(', ')}`);
                            } else {
                              alert('Не удалось распознать данные из названия.\n\nФормат: "Тип нагрузки+Группа мышц+Сложность.RPE8"');
                            }
                          }}
                        >
                          Распарсить
                        </AdminButton>
                      )}
                    </div>
                    <p style={hintStyle}>
                      Формат: «Ловкость+низ тела+продвинутый.RPE8» — нажмите «Распарсить» для автозаполнения
                    </p>
                  </div>

                  {/* URL видео */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>URL видео<Req /></label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="url"
                        name="videoUrl"
                        value={formData.videoUrl}
                        onChange={handleChange}
                        required
                        placeholder="ID или ссылка на видео"
                        style={{ ...inputStyle, width: 'auto', flex: '1 1 240px', minWidth: 0 }}
                      />
                      {formData.videoUrl && formData.videoUrl.includes('kinescope.io') && (
                        <AdminButton
                          type="button"
                          tone="secondary"
                          onClick={handleFetchKinescopeMetadata}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 size={20} className="animate-spin" aria-hidden />
                          ) : (
                            <RefreshCw size={20} aria-hidden />
                          )}
                          {isLoading ? 'Загрузка...' : 'Получить данные'}
                        </AdminButton>
                      )}
                    </div>
                    <p style={hintStyle}>
                      После вставки URL нажмите «Получить данные» для автозаполнения превью
                    </p>

                    {/* Загрузка файла напрямую на Kinescope */}
                    <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>или загрузить файл</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor="videoFileUpload" style={uploadLabelStyle(uploadProgress !== null)}>
                        <Upload size={20} aria-hidden />
                        Загрузить видеофайл
                      </label>
                      <input
                        id="videoFileUpload"
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileUpload}
                        disabled={uploadProgress !== null}
                        className="hidden"
                      />
                      {uploadProgress !== null && (
                        <ProgressBar value={uploadProgress} label="Загрузка" />
                      )}
                    </div>

                    {/* Загрузка файла в собственное S3-хранилище (reg.ru) */}
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor="s3FileUpload" style={uploadLabelStyle(s3UploadProgress !== null)}>
                        <CloudUpload size={20} aria-hidden />
                        Загрузить файл в хранилище
                      </label>
                      <input
                        id="s3FileUpload"
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleS3FileUpload}
                        disabled={s3UploadProgress !== null}
                        className="hidden"
                      />
                      {s3UploadProgress !== null && (
                        <ProgressBar value={s3UploadProgress} label="Загрузка в хранилище" />
                      )}
                      <p style={hintStyle}>
                        Только готовый к вебу MP4 (H.264, до 1080p, ~4-5 Мбит/с): транскодинга
                        нет — что залито, то и получат телефоны. Исходник .mov с камеры
                        (гигабайтный, 2.7K) у пользователей НЕ играется — сначала экспортируй
                        в MP4. Модуль на 10 минут ≈ 300-400 МБ.
                      </p>
                    </div>
                  </div>

                  {/* Превью */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Превью</label>
                    <div className="space-y-3">
                      {/* Текущее превью — всегда 16:9, как в плеере */}
                      {formData.thumbnail && (
                        <div
                          className="relative w-full overflow-hidden"
                          style={{
                            aspectRatio: '16 / 9',
                            maxWidth: 480,
                            background: 'var(--color-night)',
                            border: '1px solid var(--border-hairline)',
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={formData.thumbnail}
                            alt="Превью видео"
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
                        style={inputStyle}
                      />

                      {/* Загрузка файла */}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="thumbnail-upload"
                        />
                        <label htmlFor="thumbnail-upload" style={uploadLabelStyle(false)}>
                          <Upload size={20} aria-hidden />
                          Загрузить с устройства
                        </label>
                        {/* Превью в S3: публичный объект, прямая ссылка без TTL */}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleS3ThumbnailUpload}
                          className="hidden"
                          id="thumbnail-s3-upload"
                          disabled={s3UploadProgress !== null}
                        />
                        <label
                          htmlFor="thumbnail-s3-upload"
                          style={uploadLabelStyle(s3UploadProgress !== null)}
                        >
                          <CloudUpload size={20} aria-hidden />
                          В хранилище S3
                        </label>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                          Опционально: загрузите своё превью
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Описание */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Опишите видео: цели, особенности, кому подходит..."
                      style={inputStyle}
                    />
                  </div>

                  {/* Категория и Сложность в одной строке */}
                  <div>
                    <label style={labelStyle}>Категория<Req /></label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      style={inputStyle}
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

                  <div>
                    <label style={labelStyle}>Сложность<Req /></label>
                    <select
                      name="difficulty"
                      value={formData.difficulty}
                      onChange={handleChange}
                      required
                      style={inputStyle}
                    >
                      <option value="BEGINNER">Начальный</option>
                      <option value="INTERMEDIATE">Средний</option>
                      <option value="ADVANCED">Продвинутый</option>
                      <option value="EXPERT">Эксперт</option>
                    </select>
                  </div>

                  {/* Аудитория */}
                  <div>
                    <label style={labelStyle}>Аудитория</label>
                    <select
                      name="audience"
                      value={formData.audience}
                      onChange={handleChange}
                      style={inputStyle}
                    >
                      <option value="HOCKEY">Хоккей (trenki.app)</option>
                      <option value="ADAPTIVE">Адаптивный (adaptive.trenki.app)</option>
                      <option value="ALL">Все платформы</option>
                    </select>
                  </div>

                  {/* Тренер */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Тренер<Req /></label>
                    <select
                      name="trainerId"
                      value={formData.trainerId}
                      onChange={handleChange}
                      required
                      style={inputStyle}
                    >
                      {trainers.map(trainer => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name} {trainer.lastName} - {trainer.speciality}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Соавторы (доп. тренеры) — мульти-тренер */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Соавторы (доп. тренеры)</label>
                    <div className="flex flex-wrap gap-2">
                      {trainers
                        .filter(trainer => trainer.id !== formData.trainerId)
                        .map(trainer => {
                          const checked = formData.coauthorIds.includes(trainer.id);
                          return (
                            <label
                              key={trainer.id}
                              className="flex items-center gap-2 cursor-pointer transition-colors"
                              style={{
                                minHeight: 44,
                                padding: '8px 12px',
                                borderRadius: 'var(--radius-pill)',
                                background: checked ? 'var(--lime-subtle)' : 'transparent',
                                border: `1px solid ${checked ? 'var(--border-lime)' : 'var(--border-hairline)'}`,
                                color: checked ? 'var(--color-brand)' : 'var(--color-ink)',
                              }}
                            >
                              <Checkbox
                                checked={checked}
                                onChange={() => {
                                  setFormData(prev => ({
                                    ...prev,
                                    coauthorIds: prev.coauthorIds.includes(trainer.id)
                                      ? prev.coauthorIds.filter(id => id !== trainer.id)
                                      : [...prev.coauthorIds, trainer.id],
                                  }));
                                }}
                              />
                              <span style={{ fontSize: 14 }}>{trainer.name} {trainer.lastName}</span>
                            </label>
                          );
                        })}
                    </div>
                    <p style={hintStyle}>
                      Ведущий тренер выбирается выше. Здесь — дополнительные соавторы видео.
                    </p>
                  </div>

                  {/* Оборудование */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Оборудование</label>
                    <input
                      type="text"
                      name="equipment"
                      value={formData.equipment}
                      onChange={handleChange}
                      placeholder="Коньки, Шлем, Клюшка, Шайба (через запятую)"
                      style={inputStyle}
                    />
                  </div>

                  {/* Теги */}
                  <div className="md:col-span-2">
                    <label style={labelStyle}>Теги</label>
                    <MultiLevelTagFilter
                      selectedTags={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                    />
                  </div>

                </div>
              </FormSection>
              )}

              {/* Вкладка: Алгоритм 2.0 */}
              {activeTab === 'algorithm' && (
              <div className="space-y-4">
              
              {/* Внутренние вкладки (sub-tabs) */}
              <div className="flex flex-wrap gap-2">
                <TabButton
                  active={algorithmSubTab === 'classification'}
                  icon={Sliders}
                  onClick={() => setAlgorithmSubTab('classification')}
                  className="flex-1"
                >
                  Классификация
                </TabButton>
                <TabButton
                  active={algorithmSubTab === 'targeting'}
                  icon={Target}
                  onClick={() => setAlgorithmSubTab('targeting')}
                  className="flex-1"
                >
                  Цели и возраст
                </TabButton>
              </div>

              {/* Секция 1: Классификация модуля */}
              {algorithmSubTab === 'classification' && (
              <FormSection icon={Sliders} title="Классификация модуля">
                <Hint>Основные параметры для автоматического подбора видео в тренировки</Hint>

                <div className="space-y-6">

                  {/* Строка 1: ТИП НАГРУЗКИ (ГЛАВНОЕ!) */}
                  <div className="space-y-4">

                    {/* Тип нагрузки - ГЛАВНОЕ ПОЛЕ */}
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--lime-subtle)',
                        border: '1px solid var(--border-lime)',
                      }}
                    >
                      <label
                        style={{
                          ...labelStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 14,
                          color: 'var(--color-ink)',
                        }}
                      >
                        <Target size={16} style={{ color: 'var(--color-brand)' }} aria-hidden />
                        <span>Тип физической нагрузки<Req /></span>
                      </label>
                      <select
                        name="типНагрузки"
                        value={formData.типНагрузки}
                        onChange={handleChange}
                        style={inputStyle}
                      >
                        <option value="">Выберите тип нагрузки</option>
                        <optgroup label="Сила и мощность">
                          <option value="MAX_STRENGTH">Максимальная сила</option>
                          <option value="POWER">Мощность</option>
                          <option value="SPEED">Скорость</option>
                        </optgroup>
                        <optgroup label="Выносливость">
                          <option value="STRENGTH_ENDURANCE">Силовая выносливость</option>
                          <option value="ANAEROBIC_ENDURANCE">Анаэробная выносливость</option>
                          <option value="AEROBIC_ENDURANCE">Аэробная выносливость</option>
                        </optgroup>
                        <optgroup label="Функциональные качества">
                          <option value="AGILITY">Ловкость</option>
                          <option value="MOBILITY">Мобильность</option>
                          <option value="TECHNICAL_SKILL">Технические навыки</option>
                        </optgroup>
                        <optgroup label="Восстановление">
                          <option value="STATIC_STRETCH">Статическая растяжка</option>
                          <option value="DYNAMIC_STRETCH">Динамическая растяжка</option>
                          <option value="PREHAB">ЛФК (профилактика травм)</option>
                        </optgroup>
                      </select>
                      <p
                        className="flex items-start gap-2"
                        style={{ ...hintStyle, color: 'var(--color-brand)' }}
                      >
                        <Star size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                        <span>Главное поле: определяет, какие характеристики развивает видео</span>
                      </p>
                    </div>

                  </div>

                  {/* Информация о влиянии на характеристики - СРАЗУ ПОСЛЕ ВЫБОРА */}
                  {formData.типНагрузки && (
                    <div
                      className="animate-in fade-in slide-in-from-top-2 duration-300"
                      style={{
                        padding: 16,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-night)',
                        border: '1px solid var(--border-hairline)',
                      }}
                    >
                      <SectionTitle icon={Sparkles}>Влияние на характеристики пользователя</SectionTitle>

                      {(() => {
                        // Определяем, какая характеристика развивается
                        const loadTypeImpact: {
                          [key: string]: {
                            char: string;
                            description: string;
                            loadTypeName: string;
                            gains: { char: string; multiplier: number }[];
                          }
                        } = {
                          'MAX_STRENGTH': { 
                            char: 'Сила', 
                            description: 'Развивает максимальную силу мышц',
                            loadTypeName: 'Максимальная сила',
                            gains: [
                              { char: 'Сила', multiplier: 1.5 }
                            ]
                          },
                          'POWER': { 
                            char: 'Сила', 
                            description: 'Развивает взрывную силу и мощность',
                            loadTypeName: 'Мощность',
                            gains: [
                              { char: 'Сила', multiplier: 1.5 },
                              { char: 'Скорость', multiplier: 0.75 }
                            ]
                          },
                          'SPEED': { 
                            char: 'Скорость', 
                            description: 'Развивает скоростные качества',
                            loadTypeName: 'Скорость',
                            gains: [
                              { char: 'Скорость', multiplier: 1.5 },
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'STRENGTH_ENDURANCE': { 
                            char: 'Выносливость', 
                            description: 'Развивает силовую выносливость',
                            loadTypeName: 'Силовая выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'ANAEROBIC_ENDURANCE': { 
                            char: 'Выносливость', 
                            description: 'Развивает анаэробную выносливость',
                            loadTypeName: 'Анаэробная выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'AEROBIC_ENDURANCE': { 
                            char: 'Выносливость', 
                            description: 'Развивает аэробную выносливость',
                            loadTypeName: 'Аэробная выносливость',
                            gains: [
                              { char: 'Выносливость', multiplier: 1.5 }
                            ]
                          },
                          'AGILITY': { 
                            char: 'Техника', 
                            description: 'Развивает ловкость и координацию',
                            loadTypeName: 'Ловкость',
                            gains: [
                              { char: 'Техника', multiplier: 1.5 }
                            ]
                          },
                          'MOBILITY': { 
                            char: 'Гибкость', 
                            description: 'Улучшает подвижность суставов',
                            loadTypeName: 'Мобильность',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'TECHNICAL_SKILL': { 
                            char: 'Техника', 
                            description: 'Совершенствует технические навыки',
                            loadTypeName: 'Технические навыки',
                            gains: [
                              { char: 'Техника', multiplier: 1.5 }
                            ]
                          },
                          'STATIC_STRETCH': { 
                            char: 'Гибкость', 
                            description: 'Улучшает гибкость через статическую растяжку',
                            loadTypeName: 'Статическая растяжка',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'DYNAMIC_STRETCH': { 
                            char: 'Гибкость', 
                            description: 'Улучшает гибкость через динамическую растяжку',
                            loadTypeName: 'Динамическая растяжка',
                            gains: [
                              { char: 'Гибкость', multiplier: 1.5 },
                              { char: 'Техника', multiplier: 0.75 }
                            ]
                          },
                          'PREHAB': { 
                            char: 'Гибкость', 
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

                        const CharIcon = CHAR_ICON[impact.char] || Target;

                        return (
                          <div className="space-y-3">
                            {/* Заголовок + LoadType badge в одну строку */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="flex items-center justify-center shrink-0"
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 'var(--radius-pill)',
                                    background: 'var(--lime-subtle)',
                                  }}
                                >
                                  <CharIcon size={20} style={{ color: 'var(--color-brand)' }} aria-hidden />
                                </span>
                                <div className="min-w-0">
                                  <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{impact.char}</p>
                                  <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '2px 0 0' }}>
                                    {impact.description}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="shrink-0"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-pill)',
                                  background: 'var(--lime-subtle)',
                                  color: 'var(--color-brand)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {impact.loadTypeName}
                              </span>
                            </div>

                            {/* Прирост - компактно */}
                            <div
                              style={{
                                padding: 12,
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--color-surface)',
                                border: '1px solid var(--border-hairline)',
                              }}
                            >
                              <p
                                className="flex items-center gap-2"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--color-muted)',
                                  margin: '0 0 8px',
                                }}
                              >
                                <TrendingUp size={16} aria-hidden />
                                Прирост за модуль (при характеристике 70)
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {impact.gains.map((gain, idx) => {
                                  const GainIcon = CHAR_ICON[gain.char] || Target;
                                  return (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1"
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-pill)',
                                        background: 'var(--lime-subtle)',
                                        border: '1px solid var(--border-lime)',
                                        fontSize: 12,
                                      }}
                                    >
                                      <GainIcon size={16} style={{ color: 'var(--color-muted)' }} aria-hidden />
                                      <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>
                                        +{calculateExampleGain(gain.multiplier)}
                                      </span>
                                      {gain.multiplier === 1.5 && (
                                        <Star size={16} style={{ color: 'var(--color-brand)' }} aria-hidden />
                                      )}
                                    </span>
                                  );
                                })}
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
                      <label style={labelStyle}>
                        Тип модуля в тренировке
                      </label>
                      <select
                        name="типМодуля"
                        value={formData.типМодуля}
                        onChange={handleChange}
                        style={inputStyle}
                      >
                        <option value="">Не указано</option>
                        <option value="Разминка">Разминка</option>
                        <option value="ОФП">ОФП (физподготовка)</option>
                        <option value="Техника">Техника</option>
                        <option value="Заминка">Заминка</option>
                      </select>
                      <p style={hintStyle}>В какой части тренировки используется</p>
                    </div>

                    {/* Сложность для алгоритма */}
                    <div>
                      <label style={labelStyle}>
                        Уровень подготовки
                      </label>
                      <select
                        name="сложность"
                        value={formData.сложность}
                        onChange={handleChange}
                        style={inputStyle}
                      >
                        <option value="">Не указано</option>
                        <option value="Новичок">Новичок</option>
                        <option value="Любитель">Любитель</option>
                        <option value="Продвинутый">Продвинутый</option>
                        <option value="Профи">Профи</option>
                      </select>
                      <p style={hintStyle}>Для кого подходит упражнение</p>
                    </div>

                  </div>

                  {/* Строка 3: Группа мышц */}
                  <div className="grid grid-cols-1 gap-4">

                    {/* Группа мышц */}
                    <div>
                      <label style={labelStyle}>
                        Целевая группа мышц
                      </label>
                      <select
                        name="группаМышц"
                        value={formData.группаМышц}
                        onChange={handleChange}
                        style={inputStyle}
                      >
                        <option value="">Не указано</option>
                        <option value="Все тело">Все тело</option>
                        <option value="Низ тела">Низ тела (ноги)</option>
                        <option value="Верх тяга">Верх тела (тяга)</option>
                        <option value="Верх жим">Верх тела (жим)</option>
                        <option value="Кор стабилизация">Кор стабилизация</option>
                        <option value="Кор динамика">Кор динамика</option>
                        <option value="ЛФК плечо">ЛФК плечо</option>
                        <option value="ЛФК колено">ЛФК колено</option>
                        <option value="ЛФК спина">ЛФК спина</option>
                      </select>
                      <p style={hintStyle}>На какие мышцы воздействует</p>
                    </div>

                  </div>

                  {/* Строка 4: RPE (метрика нагрузки) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Gauge size={16} aria-hidden />
                        RPE минимум (1-10)
                      </label>
                      <input
                        type="number"
                        name="rpeMin"
                        value={formData.rpeMin}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        placeholder="Например: 3"
                        style={inputStyle}
                      />
                      <p style={hintStyle}>Минимальные усилия/энергозатраты</p>
                    </div>

                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Gauge size={16} aria-hidden />
                        RPE максимум (1-10)
                      </label>
                      <input
                        type="number"
                        name="rpeMax"
                        value={formData.rpeMax}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        placeholder="Например: 7"
                        style={inputStyle}
                      />
                      <p style={hintStyle}>Максимальные усилия/энергозатраты</p>
                    </div>

                  </div>

                </div>
              </FormSection>
              )}

              {/* Секция 2: Цели и возрастные группы */}
              {algorithmSubTab === 'targeting' && (
              <FormSection icon={Target} title="Цели и возрастные группы">
                <Hint>Укажите, для каких целей тренировок и возрастных групп подходит это видео</Hint>

                <div className="space-y-6">

                  {/* Возрастные группы (множественный выбор) */}
                  <div>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Users size={16} aria-hidden />
                      Возрастные группы
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.values(AgeGroup).map((group) => {
                        const labels: Record<string, string> = {
                          CHILD: 'Дети (до 12 лет)',
                          TEEN: 'Подростки (13-17 лет)',
                          YOUNG_ADULT: 'Молодые (18-35 лет)',
                          ADULT: 'Взрослые (36+ лет)',
                        };

                        return (
                          <CheckRow
                            key={group}
                            icon={AGE_GROUP_ICON[group]}
                            checked={formData.ageGroups.includes(group)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  ageGroups: [...prev.ageGroups, group]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  ageGroups: prev.ageGroups.filter(g => g !== group)
                                }));
                              }
                            }}
                          >
                            {labels[group]}
                          </CheckRow>
                        );
                      })}
                    </div>
                    <p className="flex items-center gap-1" style={{ ...hintStyle, marginTop: 8 }}>
                      <Check size={16} aria-hidden />
                      Выбрано: {formData.ageGroups.length > 0 ? `${formData.ageGroups.length} из 4` : 'Не указано'}
                    </p>

                    {/* СФП — подходит не только хоккею */}
                    <div
                      style={{
                        marginTop: 24,
                        paddingTop: 16,
                        borderTop: '1px solid var(--border-hairline)',
                      }}
                    >
                      <CheckRow
                        icon={Dumbbell}
                        checked={formData.isSfp}
                        onChange={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            isSfp: e.target.checked,
                            sports: e.target.checked ? prev.sports : [],
                          }))
                        }
                      >
                        СФП (общая физподготовка)
                      </CheckRow>
                      <p style={{ ...hintStyle, paddingLeft: 8 }}>
                        Тренировка подходит не только хоккею — укажи виды спорта
                      </p>

                      {formData.isSfp && (
                        <div style={{ marginTop: 12, paddingLeft: 32 }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {([
                              ['HOCKEY', 'Хоккей'],
                              ['FOOTBALL', 'Футбол'],
                              ['BASKETBALL', 'Баскетбол'],
                              ['BOXING', 'Бокс'],
                            ] as const).map(([value, label]) => (
                              <CheckRow
                                key={value}
                                icon={SPORT_ICON[value]}
                                checked={formData.sports.includes(value)}
                                onChange={(e) =>
                                  setFormData(prev => ({
                                    ...prev,
                                    sports: e.target.checked
                                      ? [...prev.sports, value]
                                      : prev.sports.filter(s => s !== value),
                                  }))
                                }
                              >
                                {label}
                              </CheckRow>
                            ))}
                          </div>
                          {formData.sports.length === 0 && (
                            <p
                              className="flex items-center gap-2"
                              style={{ ...hintStyle, marginTop: 8, color: 'var(--color-danger)' }}
                            >
                              <AlertTriangle size={16} aria-hidden />
                              Выбери хотя бы один вид спорта
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Цели тренировок (множественный выбор) */}
                  <div>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Target size={16} aria-hidden />
                      Цели тренировок
                    </label>
                    {/* max-h убран: целей всего 7, скрытый скролл прятал часть списка */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.values(TrainingGoal).map((goal) => {
                        const goalInfo = GOAL_LABELS[goal];
                        return (
                          <CheckRow
                            key={goal}
                            icon={GOAL_ICON[goal] || Target}
                            checked={formData.trainingGoals.includes(goal)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData(prev => ({
                                  ...prev,
                                  trainingGoals: [...prev.trainingGoals, goal]
                                }));
                              } else {
                                setFormData(prev => ({
                                  ...prev,
                                  trainingGoals: prev.trainingGoals.filter(g => g !== goal)
                                }));
                              }
                            }}
                          >
                            {goalInfo.label}
                          </CheckRow>
                        );
                      })}
                    </div>
                    <p className="flex items-center gap-1" style={{ ...hintStyle, marginTop: 8 }}>
                      <Check size={16} aria-hidden />
                      Выбрано: {formData.trainingGoals.length > 0 ? `${formData.trainingGoals.length} из 7` : 'Не указано'}
                    </p>
                  </div>

                </div>
              </FormSection>
              )}

              </div>
              )}

              {/* Кнопки управления (всегда видны) */}
              <div className="flex flex-wrap justify-end gap-3" style={{ paddingTop: 16 }}>
                <AdminButton
                  type="button"
                  tone="secondary"
                  icon={X}
                  onClick={() => setShowForm(false)}
                >
                  Отмена
                </AdminButton>
                <AdminButton type="submit" tone="primary" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                  ) : (
                    <Save size={20} aria-hidden />
                  )}
                  {isLoading ? 'Сохранение...' : editingVideoId ? 'Сохранить изменения' : 'Добавить видео'}
                </AdminButton>
              </div>
            </form>
          </AdminCard>
        )}

        {/* Список видео */}
        <div>
          <SectionTitle icon={VideoIcon}>Все видео</SectionTitle>
          {isListLoading ? (
            // Скелетон, а не «Видео пока нет»: пустое состояние больше не врёт при загрузке
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: 148,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--border-hairline)',
                  }}
                />
              ))}
            </div>
          ) : listError ? (
            <EmptyState
              tone="danger"
              icon={AlertTriangle}
              title="Не удалось загрузить список видео"
              hint="Обновите страницу или проверьте соединение"
            />
          ) : videos.length === 0 ? (
            <EmptyState
              icon={VideoOff}
              title="Видео пока нет"
              hint="Нажмите «Добавить видео», чтобы создать первое"
            />
          ) : (
            <div className="space-y-3">
              {videos.map((video) => {
                const missingFields = getMissingAlgorithmFields(video);
                const ModuleIcon =
                  (video.типМодуля && MODULE_TYPE_ICON[video.типМодуля]) || VideoIcon;
                return (
                <AdminCard key={video.id}>
                  {/* Шапка: заголовок в потоке + статус справа (был absolute + pr-28) */}
                  <div className="flex items-start justify-between gap-3">
                    <h3
                      className="flex-1 min-w-0 line-clamp-2"
                      style={{ fontSize: 16, fontWeight: 700, margin: 0 }}
                    >
                      {video.title}
                    </h3>
                    <span
                      className="shrink-0 inline-flex items-center gap-1"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-pill)',
                        background: video.isPublished
                          ? 'var(--lime-subtle)'
                          : 'rgba(174,171,187,0.15)',
                        color: video.isPublished ? 'var(--color-brand)' : 'var(--color-muted)',
                      }}
                    >
                      {video.isPublished ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                      {video.isPublished ? 'Опубликовано' : 'Черновик'}
                    </span>
                  </div>

                  {missingFields.length > 0 && (
                    <div
                      className="flex items-start gap-2"
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255,140,74,0.12)',
                        border: '1px solid rgba(255,140,74,0.30)',
                        fontSize: 13,
                        color: 'var(--color-danger)',
                      }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
                      <span>Не заполнено: {missingFields.join(', ')}</span>
                    </div>
                  )}

                  {/* Тип модуля (если указан) */}
                  {video.типМодуля && (
                    <div style={{ marginTop: 12 }}>
                      <span
                        className="inline-flex items-center gap-1"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '4px 12px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--lime-subtle)',
                          border: '1px solid var(--border-lime)',
                          color: 'var(--color-brand)',
                        }}
                      >
                        <ModuleIcon size={16} aria-hidden />
                        {video.типМодуля}
                      </span>
                    </div>
                  )}

                  {/* Информация о тренере */}
                  <p
                    className="truncate"
                    style={{ fontSize: 13, color: 'var(--color-muted)', margin: '12px 0 0' }}
                  >
                    Тренер: {video.trainer.name}
                  </p>

                  {/* Категория и длительность */}
                  <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '4px 0 0' }}>
                    {video.category} • {video.durationFormatted || formatDuration(video.duration)}
                  </p>

                  {/* Кнопки: одно primary-действие, остальные — ghost */}
                  <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 16 }}>
                    <AdminButton
                      type="button"
                      tone="secondary"
                      icon={Pencil}
                      onClick={() => handleEditVideo(video)}
                    >
                      Редактировать
                    </AdminButton>
                    <Link
                      href={`/video/${video.id}`}
                      className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                      style={{
                        minHeight: 44,
                        padding: '10px 20px',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--color-ink)',
                        border: '1px solid var(--border-hairline)',
                      }}
                    >
                      <Eye size={20} aria-hidden />
                      Просмотр
                    </Link>
                    <AdminButton
                      type="button"
                      tone={video.athletesNotifiedAt ? 'secondary' : 'primary'}
                      onClick={() => handleNotifyAthletes(video)}
                      disabled={!video.isPublished}
                      title={!video.isPublished ? 'Сначала опубликуйте видео' : undefined}
                    >
                      {video.athletesNotifiedAt ? (
                        <>
                          <BellRing size={20} aria-hidden />
                          Уведомлены
                          <Check size={20} aria-hidden />
                        </>
                      ) : (
                        <>
                          <Bell size={20} aria-hidden />
                          Опубликовать для атлетов
                        </>
                      )}
                    </AdminButton>
                    <button
                      type="button"
                      onClick={() => handleDeleteVideo(video.id)}
                      aria-label="Удалить видео"
                      title="Удалить видео"
                      className="ml-auto inline-flex items-center justify-center transition-opacity hover:opacity-85"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-pill)',
                        background: 'transparent',
                        border: '1px solid rgba(255,140,74,0.30)',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={20} aria-hidden />
                    </button>
                  </div>
                </AdminCard>
                );
              })}
            </div>
          )}
        </div>
    </AdminPage>
  );
};

export default AdminVideosPage;
