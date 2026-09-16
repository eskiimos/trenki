'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  RefreshCw,
  Upload,
  Film,
  List,
  Loader2,
  Check,
} from 'lucide-react';
import {
  MediaJobBadge,
  MediaJobError,
  acquireUploadWakeLock,
  isAbortError,
  isJobActive,
  uploadFileToS3,
  useLeaveWarning,
  useMediaJobs,
  useUploadAbortRef,
} from '@/components/admin/media-upload';
import { isRawUploadUrl } from '@/lib/media/url-plan';

interface Short {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  trainerId?: string | null;
  tags: string[];
  isPublished: boolean;
  isPinned?: boolean;
  viewsCount: number;
  order: number;
  createdAt: string;
  /** Намерение публикации шортса на обработке (из /api/admin/shorts), иначе null. */
  publishIntent?: boolean | null;
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
  // Имя только что залитого (ещё не сохранённого) файла — статус в форме и
  // предупреждение при уходе со страницы.
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Текущая заливка отменяется при переключении карточки/сбросе формы и при
  // уходе со страницы — иначе файл записался бы в другую тренью.
  const uploadAbortRef = useUploadAbortRef();
  // videoUrl и обложка на момент открытия: пока админ их не менял, форму можно
  // обновить результатом обработки, а обложку не слать в PUT.
  const openedVideoUrlRef = useRef<string | null>(null);
  const openedThumbnailRef = useRef<string>('');
  // Зеркало текущего значения поля обложки (для onSettled вне рендера).
  const thumbnailFieldRef = useRef<string>('');
  const editingShortIdRef = useRef<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [trainerId, setTrainerId] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  // Сырой текст поля тегов: раньше value={tags.join(', ')} + парсинг на каждый
  // ввод не давал напечатать запятую (хвостовой ", " срезался фильтром). Держим
  // строку как есть, парсим в массив только при отправке.
  const [tagsInput, setTagsInput] = useState('');
  const parseTags = (s: string): string[] =>
    Array.from(new Set(s.split(',').map((t) => t.trim()).filter(Boolean)));
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

  const fetchShorts = async (): Promise<Short[]> => {
    try {
      // Админский список: с черновиками и шортсами на обработке (публичный
      // /api/shorts отдаёт только опубликованные).
      const response = await fetch('/api/admin/shorts', { cache: 'no-store' });
      const data = await response.json();
      setShorts(data.shorts || []);
      return data.shorts || [];
    } catch (error) {
      console.error('Error loading shorts:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const abortUpload = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadProgress(null);
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

  // Статусы серверной обработки; завершилась — перечитываем список.
  const {
    jobs: mediaJobs,
    refresh: refreshMediaJobs,
    retry: retryMediaJob,
    dismiss: dismissMediaJob,
  } = useMediaJobs('SHORT', async (settledIds) => {
    const list = await fetchShorts();
    // Открытая тренька, чей файл только что обработан: подтягиваем новый
    // videoUrl и обложку, если админ сам эти поля в форме не менял.
    const id = editingShortIdRef.current;
    const fresh = id && settledIds.includes(id) ? list.find((sh) => sh.id === id) : undefined;
    if (!fresh) return;
    // Значения ref — до setState: updater React выполнит позже, при рендере.
    const openedUrl = openedVideoUrlRef.current;
    const openedThumb = openedThumbnailRef.current;
    openedVideoUrlRef.current = fresh.videoUrl;
    // Базу обложки сдвигаем, только если поле реально получит кадр воркера.
    if (thumbnailFieldRef.current === openedThumb) openedThumbnailRef.current = fresh.thumbnail || '';
    setVideoUrl((prev) => (prev === openedUrl ? fresh.videoUrl : prev));
    setThumbnail((prev) => (prev === openedThumb ? fresh.thumbnail || '' : prev));
  });

  // Идёт заливка или файл залит, но не сохранён — спросить перед сбросом формы.
  const confirmDiscardUpload = () => {
    const busy = uploadAbortRef.current !== null;
    if (!busy && !uploadedFileName) return true;
    return window.confirm(
      busy ? 'Загрузка файла будет прервана — продолжить?' : 'Загруженный файл ещё не сохранён — отменить?',
    );
  };
  useLeaveWarning(uploadProgress !== null || (showForm && !!uploadedFileName));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadProgress !== null) {
      alert('Дождитесь окончания загрузки файла');
      return;
    }
    if (!videoUrl) {
      alert('Загрузите видеофайл');
      return;
    }
    if (saving) return;
    setSaving(true);

    const finalTags = parseTags(tagsInput);
    setTags(finalTags);
    const shortData = {
      title,
      description,
      videoUrl,
      // При редактировании обложку шлём, только если её меняли: иначе устаревшая
      // форма затёрла бы кадр, поставленный воркером.
      thumbnail: editingShortId && thumbnail === openedThumbnailRef.current ? undefined : thumbnail,
      trainerId: trainerId || null,
      tags: finalTags,
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
        const data = await response.json().catch(() => ({}));
        const linkIgnored =
          !!data.videoUrlIgnored && videoUrl !== openedVideoUrlRef.current && !isRawUploadUrl(videoUrl);
        alert(
          (data.processing
            ? `${editingShortId ? 'Тренька сохранена' : 'Тренька добавлена'}. Видео обрабатывается на сервере ` +
              `(обычно несколько минут) — ${isPublished ? 'появится в ленте автоматически' : 'останется черновиком'}.`
            : editingShortId
              ? 'Тренька обновлена!'
              : 'Тренька добавлена!') +
            (linkIgnored ? '\n\nСсылка не изменена: видео уже перенесено в наше хранилище.' : ''),
        );
        resetForm();
        fetchShorts();
        void refreshMediaJobs();
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          // Воркер только что обновил тренью: подтягиваем свежие данные (залитый
          // файл не трогаем) — повторное сохранение безопасно.
          void fetchShorts();
          void refreshMediaJobs();
        }
        alert(`Ошибка: ${errorData.error || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Error saving short:', error);
      alert('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  const handleEditShort = (short: Short) => {
    // Та же тренька уже открыта — просто вернуться к форме.
    if (showForm && editingShortId === short.id) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!confirmDiscardUpload()) return;
    abortUpload();
    editingShortIdRef.current = short.id;
    setEditingShortId(short.id);
    setUploadedFileName(null);
    openedVideoUrlRef.current = short.videoUrl;
    openedThumbnailRef.current = short.thumbnail || '';
    setTitle(short.title);
    setDescription(short.description || '');
    setVideoUrl(short.videoUrl);
    setThumbnail(short.thumbnail || '');
    setTrainerId(short.trainerId || '');
    setTags(short.tags);
    setTagsInput(short.tags.join(', '));
    setOrder(short.order);
    // Пока видео обрабатывается (или обработка упала), isPublished в БД временно
    // false — в форме показываем то, что админ выбирал (намерение задачи). Оно
    // приходит со списком; статусы задач — запасной источник.
    const job = mediaJobs[short.id];
    setIsPublished(
      short.publishIntent ??
        (job && (isJobActive(job) || job.status === 'FAILED') ? job.publishOnReady : short.isPublished),
    );
    setAudience((short as any).audience || 'HOCKEY');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Закрепить/открепить тренёк: точечный PUT { isPinned }, остальные поля
  // роут не трогает. Закреплённый показывается первым в ленте /shorts.
  // Поддерживается один закреплённый: перед закреплением нового старый
  // открепляем вручную этим же тумблером.
  const handleTogglePin = async (short: Short) => {
    try {
      const response = await fetch(`/api/shorts/${short.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !short.isPinned }),
      });
      if (response.ok) {
        fetchShorts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Ошибка: ${errorData.error || 'Не удалось изменить закрепление'}`);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
      alert('Ошибка при закреплении');
    }
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
    abortUpload();
    editingShortIdRef.current = null;
    setEditingShortId(null);
    setUploadedFileName(null);
    openedVideoUrlRef.current = null;
    openedThumbnailRef.current = '';
    setTitle('');
    setDescription('');
    setVideoUrl('');
    setThumbnail('');
    setTrainerId('');
    setTags([]);
    setTagsInput('');
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
    formData.append('kind', 'short'); // вертикальная обложка 9:16 (см. /api/upload)

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

  // Видеофайл тренька → наше S3 как сырой исходник (s3://uploads/...). После
  // сохранения сервер пережимает его (src/lib/media/worker.ts), кладёт публичный
  // mp4 и сам подменяет videoUrl (и обложку, если пусто).
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    abortUpload();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    const isCurrent = () => uploadAbortRef.current === controller;
    setUploadProgress(0);
    try {
      const url = await uploadFileToS3(
        file,
        'short',
        (p) => {
          if (isCurrent()) setUploadProgress(p);
        },
        controller.signal,
      );
      if (!isCurrent()) return;
      setVideoUrl(url);
      // Функциональный апдейт: название, введённое во время заливки, не затираем.
      const name = file.name.replace(/\.[^/.]+$/, '');
      setTitle((t) => (t.trim() ? t : name));
      setUploadedFileName(file.name);
    } catch (error: any) {
      if (isAbortError(error) || !isCurrent()) return;
      console.error('Video upload error:', error);
      alert(`Ошибка загрузки: ${error.message}`);
    } finally {
      if (isCurrent()) {
        uploadAbortRef.current = null;
        setUploadProgress(null);
      }
    }
  };

  thumbnailFieldRef.current = thumbnail;
  const editingJob = editingShortId ? mediaJobs[editingShortId] : undefined;
  // Kinescope временно исключён для новых треньк (решение владельца 16.09): поле
  // ссылки — только у старых записей со сторонним URL.
  // Решаем по URL из списка: иначе очищенное поле исчезало бы вместе с кнопкой.
  const originalVideoUrl = editingShortId ? shorts.find((sh) => sh.id === editingShortId)?.videoUrl ?? '' : '';
  const isOwnStorage = (url: string) => url.startsWith('s3://') || url.includes('s3.regru.cloud');
  const showLegacyUrlField = !!originalVideoUrl && !isOwnStorage(originalVideoUrl) && !videoUrl.startsWith('s3://');

  return (
    <AdminPage>
      <PageHeader
        title="Треньки"
        icon={Zap}
        backHref="/admin"
        actions={
          !showForm ? (
            <AdminButton icon={Plus} onClick={() => setShowForm(true)}>
              Добавить тренью
            </AdminButton>
          ) : undefined
        }
      />

      {/* Форма добавления/редактирования */}
      {showForm && (
        <AdminCard style={{ marginBottom: 24 }}>
          <SectionTitle icon={Zap}>
            {editingShortId ? 'Редактировать тренью' : 'Добавить новую тренью'}
          </SectionTitle>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Название */}
            <div>
              <label style={labelStyle}>Название *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={inputStyle}
                required
              />
            </div>

            {/* Описание */}
            <div>
              <label style={labelStyle}>Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ ...inputStyle, minHeight: 88, resize: 'vertical' }}
                rows={3}
              />
            </div>

            {/* Тренер */}
            <div>
              <label style={labelStyle}>Тренер</label>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
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
              <label style={labelStyle}>Аудитория</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              >
                <option value="HOCKEY">Хоккей (trenki.app)</option>
                <option value="ADAPTIVE">Адаптивный (adaptive.trenki.app)</option>
                <option value="ALL">Все платформы</option>
              </select>
            </div>

            {/* Видео */}
            <div>
              <label style={labelStyle}>Видео *</label>
              {showLegacyUrlField && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="https://kinescope.io/..."
                    />
                    {videoUrl.includes('kinescope.io') && (
                      <AdminButton
                        type="button"
                        tone="secondary"
                        icon={RefreshCw}
                        onClick={handleFetchKinescopeMetadata}
                        style={{ flexShrink: 0 }}
                      >
                        Получить данные
                      </AdminButton>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
                    Старое видео по ссылке. Чтобы перенести его в наше хранилище — загрузите файл ниже.
                  </div>
                </>
              )}

              {editingJob && (isJobActive(editingJob) || editingJob.status === 'FAILED') && (
                <div style={{ marginTop: 8 }}>
                  <MediaJobBadge job={editingJob} />
                  <MediaJobError
                    job={editingJob}
                    onRetry={retryMediaJob}
                    onDismiss={originalVideoUrl && !isRawUploadUrl(originalVideoUrl) ? dismissMediaJob : undefined}
                  />
                </div>
              )}

              {uploadProgress === null && uploadedFileName && (
                <div className="flex items-start gap-2" style={{ fontSize: 13, marginTop: 8 }}>
                  <Check size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-brand)' }} aria-hidden />
                  <span>
                    Файл «{uploadedFileName}» загружен. После сохранения сервер обработает его — тренька
                    появится в ленте автоматически.
                  </span>
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                <label
                  htmlFor="shortsVideoFileUpload"
                  onClick={acquireUploadWakeLock}
                  className="inline-flex items-center justify-center gap-2 transition-opacity hover:opacity-85"
                  style={{
                    minHeight: 44,
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 14,
                    fontWeight: 700,
                    background: 'var(--color-brand)',
                    color: 'var(--color-night)',
                    cursor: uploadProgress !== null ? 'not-allowed' : 'pointer',
                    opacity: uploadProgress !== null ? 0.6 : 1,
                  }}
                >
                  <Upload size={20} aria-hidden />
                  {videoUrl ? 'Заменить видеофайл' : 'Загрузить видеофайл'}
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
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 8 }}>
                      Загрузка: {uploadProgress}% — не блокируйте экран и не уходите со страницы до конца
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Загрузка видеофайла"
                      style={{
                        width: '100%',
                        height: 8,
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        className="transition-all"
                        style={{
                          width: `${uploadProgress}%`,
                          height: '100%',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--color-brand)',
                        }}
                      />
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 8 }}>
                  Подойдёт файл прямо с телефона (MOV или MP4): сервер сам сожмёт его. Если не
                  загрузить обложку — возьмём кадр из видео.
                </div>
              </div>
            </div>

            {/* Превью */}
            <div>
              <label style={labelStyle}>Превью (URL или загрузить файл)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                  type="text"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  style={inputStyle}
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ ...inputStyle, padding: '8px 12px' }}
                  className="file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:cursor-pointer file:font-bold file:text-[13px] file:bg-brand file:text-night"
                />
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
                  Обложка приводится к 9:16 (1080×1920) — загружай вертикальную картинку,
                  горизонтальную обрежет по центру.
                </div>
                {/* Превью в той же геометрии, что лента и каталог (9:16, object-cover):
                    раньше width/height без object-fit сплющивали 16:9-файл. */}
                {thumbnail && (
                  <div
                    style={{
                      position: 'relative',
                      width: 180,
                      height: 320,
                      marginTop: 8,
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--color-night)',
                    }}
                  >
                    <Image src={thumbnail} alt="Preview" fill sizes="180px" className="object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Теги */}
            <div>
              <label style={labelStyle}>Теги (через запятую)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onBlur={() => setTags(parseTags(tagsInput))}
                style={inputStyle}
                placeholder="дриблинг, катание, тренировка"
              />
            </div>

            {/* Порядок отображения */}
            <div>
              <label style={labelStyle}>Порядок отображения</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

            {/* Опубликовано */}
            <label
              htmlFor="isPublished"
              className="flex items-center gap-3 cursor-pointer"
              style={{ minHeight: 44 }}
            >
              <input
                type="checkbox"
                id="isPublished"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                style={{ width: 20, height: 20, accentColor: 'var(--color-brand)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Опубликовано</span>
            </label>

            {/* Кнопки */}
            <div className="flex flex-wrap gap-3">
              <AdminButton type="submit" icon={Save} disabled={uploadProgress !== null || saving}>
                {editingShortId ? 'Обновить' : 'Добавить'}
              </AdminButton>
              {editingShortId && (
                <AdminButton
                  type="button"
                  tone="secondary"
                  icon={X}
                  onClick={() => {
                    if (confirmDiscardUpload()) resetForm();
                  }}
                >
                  Отменить
                </AdminButton>
              )}
            </div>
          </form>
        </AdminCard>
      )}

      {/* Список тренек */}
      <AdminCard>
        <SectionTitle icon={List}>Список тренек ({shorts.length})</SectionTitle>

        {isLoading ? (
          <EmptyState icon={Loader2} title="Загрузка…" />
        ) : shorts.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Тренек пока нет"
            hint="Нажми «Добавить тренью» в шапке страницы"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shorts.map((short) => (
              <div
                key={short.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-hairline)',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                }}
              >
                {/* Структура: превью слева, контент справа */}
                <div className="flex gap-3 items-stretch">
                  {/* Миниатюра 9:16 */}
                  <div
                    className="shrink-0 overflow-hidden relative flex items-center justify-center"
                    style={{
                      width: 64,
                      height: 114,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-night)',
                    }}
                  >
                    {short.thumbnail ? (
                      <Image
                        src={short.thumbnail}
                        alt={short.title}
                        fill
                        className="object-cover"
                      />
                    ) : short.videoUrl && !short.videoUrl.startsWith('s3://') ? (
                      <video
                        src={short.videoUrl}
                        className="w-full h-full object-cover"
                        preload="metadata"
                        muted
                        playsInline
                      />
                    ) : (
                      <Film size={20} style={{ color: 'var(--color-muted)' }} aria-hidden />
                    )}
                  </div>

                  {/* Информация */}
                  <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
                    {/* Заголовок + статус */}
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        className="flex-1 min-w-0 truncate"
                        style={{ fontSize: 14, fontWeight: 700 }}
                      >
                        {short.title}
                      </h3>
                      {short.isPinned && (
                        <span
                          className="inline-flex items-center gap-1 shrink-0"
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-pill)',
                            background: 'var(--color-brand)',
                            color: 'var(--color-night)',
                          }}
                          title="Закреплён первым в ленте"
                        >
                          <Pin size={16} aria-hidden />
                          Закреплён
                        </span>
                      )}
                      <span
                        className="shrink-0"
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: short.isPublished
                            ? 'rgba(161,255,74,0.15)'
                            : 'rgba(255,255,255,0.08)',
                          color: short.isPublished ? 'var(--color-brand)' : 'var(--color-muted)',
                        }}
                      >
                        {short.isPublished ? 'Опубликован' : 'Черновик'}
                      </span>
                    </div>
                    {(isJobActive(mediaJobs[short.id]) || mediaJobs[short.id]?.status === 'FAILED') && (
                      <div style={{ marginTop: 6 }}>
                        <MediaJobBadge job={mediaJobs[short.id]} />
                      </div>
                    )}
                    <MediaJobError
                      job={mediaJobs[short.id]}
                      onRetry={retryMediaJob}
                      onDismiss={short.videoUrl && !isRawUploadUrl(short.videoUrl) ? dismissMediaJob : undefined}
                    />

                    {/* Описание */}
                    {short.description && (
                      <p
                        className="line-clamp-1"
                        style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}
                      >
                        {short.description}
                      </p>
                    )}

                    {/* Мета */}
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}>
                      Автор: {getTrainerName(short.trainerId)}
                    </div>
                    {short.tags.length > 0 && (
                      <div
                        className="hidden sm:block truncate"
                        style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 4 }}
                      >
                        Теги: {short.tags.join(', ')}
                      </div>
                    )}

                    {/* Кнопки */}
                    <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
                      <AdminButton
                        size="sm"
                        tone="secondary"
                        icon={Pencil}
                        onClick={() => handleEditShort(short)}
                        aria-label="Редактировать тренью"
                      >
                        <span className="hidden sm:inline">Редактировать</span>
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        tone={short.isPinned ? 'primary' : 'secondary'}
                        icon={short.isPinned ? PinOff : Pin}
                        onClick={() => handleTogglePin(short)}
                        aria-label={short.isPinned ? 'Открепить тренью' : 'Закрепить тренью'}
                      >
                        <span className="hidden sm:inline">
                          {short.isPinned ? 'Открепить' : 'Закрепить'}
                        </span>
                      </AdminButton>
                      <AdminButton
                        size="sm"
                        tone="danger"
                        icon={Trash2}
                        onClick={() => handleDeleteShort(short.id)}
                        aria-label="Удалить тренью"
                      >
                        <span className="hidden sm:inline">Удалить</span>
                      </AdminButton>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
