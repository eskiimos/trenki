'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MultiLevelTagFilter from '@/components/MultiLevelTagFilter';
import { AgeGroup, TrainingGoal } from '@/generated/prisma';
import { GOAL_LABELS } from '@/lib/training-algorithm-v3';

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

const AdminVideosPage = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]); // ID тегов из базы
  const [activeTab, setActiveTab] = useState<'basic' | 'algorithm'>('basic');
  const [algorithmSubTab, setAlgorithmSubTab] = useState<'classification' | 'targeting'>('classification');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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

      // Маппинг кириллических полей на латиницу для API
      const payload = {
        title: formData.title,
        description: formData.description,
        videoUrl: formData.videoUrl,
        thumbnail: formData.thumbnail,
        category: formData.category,
        difficulty: formData.difficulty,
        trainerId: formData.trainerId,
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
          
          // 🤖 Умный парсинг названия для автозаполнения полей алгоритма
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

      alert(`Видео успешно загружено на Kinescope!\nURL: ${kinescopeUrl}`);
    } catch (error: any) {
      console.error('Video upload error:', error);
      alert(`Ошибка загрузки: ${error.message}`);
      setUploadProgress(null);
    }

    // Сбрасываем input
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
              
              {/* Табы */}
              <div className="flex gap-2 border-b border-white/10 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('basic')}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === 'basic' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-[#1a1f3a] text-gray-400 hover:text-white hover:bg-[#2d3448]'
                  }`}
                >
                  📹 Основное
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('algorithm')}
                  className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === 'algorithm' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-[#1a1f3a] text-gray-400 hover:text-white hover:bg-[#2d3448]'
                  }`}
                >
                  ⚙️ Алгоритм 2.0
                </button>
              </div>

              {/* Вкладка: Основное */}
              {activeTab === 'basic' && (
              <fieldset className="border border-blue-500/30 rounded-lg p-4 md:p-6 bg-blue-900/5">
                <legend className="px-3 text-base font-bold text-blue-300">📹 Основная информация</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  
                  {/* Название */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Название *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        required
                        placeholder="Например: Ловкость+низ тела+продвинутый.RPE8"
                        className="flex-1 bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      {formData.title && (
                        <button
                          type="button"
                          onClick={() => {
                            const normalizedInput = normalizeTitleForCompare(formData.title);
                            const duplicate = videos.find((video) =>
                              normalizeTitleForCompare(video.title) === normalizedInput
                            );
                            if (duplicate && duplicate.id !== editingVideoId) {
                              const proceed = confirm(
                                `⚠️ Видео с таким названием уже существует:\n${duplicate.title}\n\nПродолжить автозаполнение?`
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
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                        >
                          🤖 Распарсить
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      💡 Формат: "Ловкость+низ тела+продвинутый.RPE8" - нажмите "Распарсить" для автозаполнения
                    </p>
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

                    {/* Загрузка файла напрямую на Kinescope */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1 h-px bg-gray-600"></div>
                      <span className="text-xs text-gray-400">или загрузить файл</span>
                      <div className="flex-1 h-px bg-gray-600"></div>
                    </div>
                    <div className="mt-2">
                      <label
                        htmlFor="videoFileUpload"
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploadProgress !== null ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                        📁 Загрузить видеофайл на Kinescope
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
                        <div className="mt-2">
                          <div className="text-sm text-gray-400 mb-1">Загрузка на Kinescope: {uploadProgress}%</div>
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

                  {/* Категория и Сложность в одной строке */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Категория *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="STRENGTH">💪 Сила</option>
                      <option value="ENDURANCE">🫀 Выносливость</option>
                      <option value="SPEED">⚡ Скорость</option>
                      <option value="TECHNIQUE">🎯 Техника</option>
                      <option value="SKATING">⛸️ Катание</option>
                      <option value="SHOOTING">🏒 Броски</option>
                      <option value="PASSING">🎯 Пас</option>
                      <option value="CHECKING">💥 Силовая борьба</option>
                      <option value="GOALKEEPER">🥅 Вратарь</option>
                      <option value="TACTICAL">🧠 Тактика</option>
                      <option value="GENERAL">🔄 Общая</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Сложность *</label>
                    <select
                      name="difficulty"
                      value={formData.difficulty}
                      onChange={handleChange}
                      required
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="BEGINNER">🟢 Начальный</option>
                      <option value="INTERMEDIATE">🔵 Средний</option>
                      <option value="ADVANCED">🟠 Продвинутый</option>
                      <option value="EXPERT">🔴 Эксперт</option>
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
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      {trainers.map(trainer => (
                        <option key={trainer.id} value={trainer.id}>
                          {trainer.name} {trainer.lastName} - {trainer.speciality}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Оборудование */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Оборудование</label>
                    <input
                      type="text"
                      name="equipment"
                      value={formData.equipment}
                      onChange={handleChange}
                      placeholder="Коньки, Шлем, Клюшка, Шайба (через запятую)"
                      className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {/* Теги */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Теги</label>
                    <MultiLevelTagFilter 
                      selectedTags={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                    />
                  </div>

                </div>
              </fieldset>
              )}

              {/* Вкладка: Алгоритм 2.0 */}
              {activeTab === 'algorithm' && (
              <div className="space-y-4">
              
              {/* Внутренние вкладки (sub-tabs) */}
              <div className="flex gap-2 bg-[#1a1f3a] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAlgorithmSubTab('classification')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                    algorithmSubTab === 'classification' 
                      ? 'bg-purple-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-[#2d3448]'
                  }`}
                >
                  ⚙️ Классификация
                </button>
                <button
                  type="button"
                  onClick={() => setAlgorithmSubTab('targeting')}
                  className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 ${
                    algorithmSubTab === 'targeting' 
                      ? 'bg-green-600 text-white shadow-lg' 
                      : 'text-gray-400 hover:text-white hover:bg-[#2d3448]'
                  }`}
                >
                  🎯 Цели и возраст
                </button>
              </div>
              
              {/* Секция 1: Классификация модуля */}
              {algorithmSubTab === 'classification' && (
              <fieldset className="border border-purple-500/30 rounded-lg p-4 md:p-6 bg-purple-900/10">
                <legend className="px-3 text-base font-bold text-purple-300">⚙️ Классификация модуля</legend>
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-300">
                    💡 Основные параметры для автоматического подбора видео в тренировки
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

                  {/* Строка 4: RPE (метрика нагрузки) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        📊 RPE минимум (1-10)
                      </label>
                      <input
                        type="number"
                        name="rpeMin"
                        value={formData.rpeMin}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        placeholder="Например: 3"
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      />
                      <p className="text-xs text-gray-400 mt-1">Минимальные усилия/энергозатраты</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        📊 RPE максимум (1-10)
                      </label>
                      <input
                        type="number"
                        name="rpeMax"
                        value={formData.rpeMax}
                        onChange={handleChange}
                        min="1"
                        max="10"
                        placeholder="Например: 7"
                        className="w-full bg-[#2d3448] text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      />
                      <p className="text-xs text-gray-400 mt-1">Максимальные усилия/энергозатраты</p>
                    </div>

                  </div>

                </div>
              </fieldset>
              )}

              {/* Секция 2: Цели и возрастные группы */}
              {algorithmSubTab === 'targeting' && (
              <fieldset className="border border-green-500/30 rounded-lg p-4 md:p-6 bg-green-900/10">
                <legend className="px-3 text-base font-bold text-green-300">🎯 Цели и возрастные группы</legend>
                
                <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-300">
                    💡 Укажите, для каких целей тренировок и возрастных групп подходит это видео
                  </p>
                </div>

                <div className="space-y-6">
                  
                  {/* Возрастные группы (множественный выбор) */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-green-300">
                      👥 Возрастные группы
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.values(AgeGroup).map((group) => {
                        const labels: Record<string, string> = {
                          CHILD: '👶 Дети (до 12 лет)',
                          TEEN: '🧒 Подростки (13-17 лет)',
                          YOUNG_ADULT: '👨 Молодые (18-35 лет)',
                          ADULT: '👴 Взрослые (36+ лет)',
                        };
                        
                        return (
                          <label key={group} className="flex items-center gap-2 p-2 rounded hover:bg-green-900/20 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
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
                              className="w-5 h-5 rounded border-2 border-green-500 bg-[#2d3448] checked:bg-green-600 checked:border-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="text-sm text-gray-200">{labels[group]}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ✓ Выбрано: {formData.ageGroups.length > 0 ? `${formData.ageGroups.length} из 4` : 'Не указано'}
                    </p>
                  </div>

                  {/* Цели тренировок (множественный выбор) */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-green-300">
                      🎯 Цели тренировок
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {Object.values(TrainingGoal).map((goal) => {
                        const goalInfo = GOAL_LABELS[goal];
                        return (
                          <label key={goal} className="flex items-center gap-2 p-2 rounded hover:bg-green-900/20 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
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
                              className="w-5 h-5 rounded border-2 border-green-500 bg-[#2d3448] checked:bg-green-600 checked:border-green-600 focus:ring-2 focus:ring-green-500 cursor-pointer"
                            />
                            <span className="text-sm text-gray-200">{goalInfo.emoji} {goalInfo.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      ✓ Выбрано: {formData.trainingGoals.length > 0 ? `${formData.trainingGoals.length} из 7` : 'Не указано'}
                    </p>
                  </div>

                </div>
              </fieldset>
              )}

              </div>
              )}

              {/* Кнопки управления (всегда видны) */}
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

                  {(() => {
                    const missingFields = getMissingAlgorithmFields(video);
                    if (missingFields.length === 0) return null;
                    return (
                      <div className="mb-2 text-xs text-red-300">
                        ⚠️ Не заполнено: {missingFields.join(', ')}
                      </div>
                    );
                  })()}
                  
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
                    {video.category} • {video.durationFormatted || formatDuration(video.duration)}
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
