'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Tag {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  loadType: string;
  icon: string | null;
  color: string | null;
  order: number;
}

interface TagProps {
  text: string;
}

const SimpleTag: React.FC<TagProps> = ({ text }) => {
  return (
    <div className="bg-[#AEABBB33] text-white text-xs rounded-full px-4 py-2">
      {text}
    </div>
  );
};

interface TagsSectionProps {
  tags?: string[];
  equipment?: string[];
  category?: string;
  difficulty?: string;
  level?: string;
  description?: string;
  title?: string;
  trainer?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  } | null;
  // Мульти-тренер: полный список авторов. Если непустой — показываем всех;
  // иначе откатываемся на одиночный trainer (обратная совместимость).
  coauthors?: {
    id: string;
    name: string;
    lastName: string;
    avatar: string | null;
  }[];
  // Новые пропсы для интерактивных тегов
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  multiSelect?: boolean;
  showFilterTags?: boolean;
  tagFilterType?: 'load' | 'muscle' | 'complexity' | 'goal' | 'all';
  gainTag?: React.ReactNode;
  // Информационные баблы
  rpeMin?: number | null;
  rpeMax?: number | null;
  moduleType?: string | null;
  loadType?: string | null;
  muscleGroup?: string | null;
}

const TagsSection: React.FC<TagsSectionProps> = ({ 
  tags = [], 
  equipment = [], 
  category, 
  difficulty, 
  level,
  description,
  title,
  trainer,
  coauthors,
  selectedTags = [],
  onTagsChange,
  multiSelect = true,
  showFilterTags = false,
  tagFilterType = 'all',
  gainTag,
  rpeMin,
  rpeMax,
  moduleType,
  loadType,
  muscleGroup,
}) => {
  const [dbTags, setDbTags] = useState<Tag[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showFilterTags) {
      fetchTags();
    }
  }, [showFilterTags, tagFilterType]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const url = tagFilterType === 'all' 
        ? '/api/tags' 
        : `/api/tags?type=${tagFilterType}`;
      const response = await fetch(url);
      const data = await response.json();
      setDbTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tagName: string) => {
    if (!onTagsChange) return;

    if (multiSelect) {
      if (selectedTags.includes(tagName)) {
        onTagsChange(selectedTags.filter(t => t !== tagName));
      } else {
        onTagsChange([...selectedTags, tagName]);
      }
    } else {
      onTagsChange(selectedTags.includes(tagName) ? [] : [tagName]);
    }
  };

  // Только теги из поля tags
  const allTags = tags.filter(Boolean);

  return (
    <div className="p-4 bg-[#101530]">
      {/* Интерактивные теги для фильтрации */}
      {showFilterTags && (
        <div className="mb-4">
          <h3 className="text-white text-sm font-medium mb-3">ФИЛЬТР ПО ТИПУ НАГРУЗКИ</h3>
          {loading ? (
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 h-9 w-24 bg-gray-700 rounded-full animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              {dbTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag.name)}
                    className={`
                      flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium
                      transition-all duration-200 flex items-center gap-1.5
                      ${isSelected 
                        ? 'text-white shadow-lg scale-105' 
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }
                    `}
                    style={{
                      backgroundColor: isSelected ? tag.color || '#A1FF4A' : undefined,
                    }}
                    title={tag.description || undefined}
                  >
                    {tag.icon && <span className="text-base">{tag.icon}</span>}
                    <span>{tag.displayName}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trainer Info — мульти-тренер: все авторы, иначе одиночный trainer */}
      {(() => {
        const authors = (coauthors && coauthors.length > 0)
          ? coauthors
          : (trainer ? [trainer] : []);
        if (authors.length === 0) return null;

        return (
          <div className="mb-4">
            {authors.length > 1 && (
              <p className="text-[#AEABBB] text-xs font-medium mb-2">Тренеры</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {authors.map((author) => (
                <Link
                  key={author.id}
                  href={`/trainers/${author.id}`}
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2d3448] flex items-center justify-center">
                    {author.avatar ? (
                      <Image
                        src={author.avatar}
                        alt={author.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-sm font-semibold">
                        {author.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium">
                    {author.name} {author.lastName}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
      
      {/* Video Title */}
      {title && (
        <div className="mb-4">
          <h2 className="text-white text-lg font-semibold leading-snug mb-2">
            {title}
          </h2>
        </div>
      )}
      
      {/* Информационные баблы видео */}
      {(() => {
        const MODULE_TYPE_LABELS: Record<string, string> = {
          WARMUP: 'Разминка',
          FITNESS: 'ОФП',
          GENERAL_PHYSICAL_PREP: 'ОФП',
          TECHNIQUE: 'Техника',
          COOLDOWN: 'Заминка',
          STRENGTH: 'Силовой',
          CARDIO: 'Кардио',
          STRETCHING: 'Растяжка',
        };
        const LOAD_TYPE_LABELS: Record<string, string> = {
          SPEED: 'Скорость',
          POWER: 'Мощность',
          MAX_STRENGTH: 'Макс. сила',
          STRENGTH_ENDURANCE: 'Силовая выносливость',
          ANAEROBIC_ENDURANCE: 'Анаэробная выносливость',
          AEROBIC_ENDURANCE: 'Аэробная выносливость',
          AGILITY: 'Ловкость',
          MOBILITY: 'Мобильность',
          STATIC_STRETCH: 'Стат. растяжка',
          DYNAMIC_STRETCH: 'Дин. растяжка',
          PREHAB: 'Преабилитация',
          TECHNICAL_SKILL: 'Техника',
          HYPERTROPHY: 'Гипертрофия',
          FLEXIBILITY: 'Гибкость',
          RECOVERY: 'Восстановление',
        };
        const MUSCLE_GROUP_LABELS: Record<string, string> = {
          LOWER_BODY: 'Низ тела',
          UPPER_PULL: 'Верх — тяга',
          UPPER_PUSH: 'Верх — жим',
          CORE_STABILITY: 'Кор (стабилизация)',
          CORE_DYNAMICS: 'Кор (динамика)',
          PREHAB_SHOULDER: 'Плечи (преаб)',
          PREHAB_KNEE: 'Колени (преаб)',
          PREHAB_BACK: 'Спина (преаб)',
          FULL_BODY: 'Всё тело',
          LEGS: 'Ноги',
          BACK: 'Спина',
          CHEST: 'Грудь',
          SHOULDERS: 'Плечи',
          ARMS: 'Руки',
          CORE: 'Кор',
          GLUTES: 'Ягодицы',
          CARDIO: 'Кардио',
        };
        const DIFFICULTY_LABELS: Record<string, string> = {
          BEGINNER: 'Начинающий',
          AMATEUR: 'Любитель',
          INTERMEDIATE: 'Средний',
          ADVANCED: 'Продвинутый',
          PRO: 'Про',
        };

        const infoBubbles = [
          moduleType && { label: MODULE_TYPE_LABELS[moduleType] || moduleType },
          loadType && { label: LOAD_TYPE_LABELS[loadType] || loadType },
          muscleGroup && { label: MUSCLE_GROUP_LABELS[muscleGroup] || muscleGroup },
          difficulty && { label: DIFFICULTY_LABELS[difficulty] || difficulty },
          (rpeMin != null || rpeMax != null) && {
            label: rpeMin != null && rpeMax != null
              ? `RPE ${rpeMin}–${rpeMax}`
              : rpeMin != null ? `RPE ${rpeMin}+` : `RPE ≤${rpeMax}`,
          },
        ].filter(Boolean) as { label: string }[];
        // Инфо-баблы, свободные теги и пилюля прироста — в ОДНОЙ flex-wrap
        // строке, чтобы не плодить этажи под плеером.
        const hasBubbles = infoBubbles.length > 0 || !!gainTag || allTags.length > 0;
        if (!hasBubbles) return null;

        return (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {gainTag}
            {infoBubbles.map((b, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-full text-xs"
                style={{ backgroundColor: '#AEABBB33', color: '#AEABBB' }}
              >
                {b.label}
              </div>
            ))}
            {allTags.map((tag, index) => (
              <SimpleTag key={`tag-${index}`} text={tag} />
            ))}
          </div>
        );
      })()}

      {/* Equipment Section — только когда список непустой (пустая карточка не нужна) */}
      {equipment.length > 0 && (
        <div className="bg-[#AEABBB33] rounded-lg p-4 mb-4">
          <h3 className="text-white text-sm font-medium mb-3">ОБОРУДОВАНИЕ</h3>
          <div className="flex flex-wrap gap-2">
            {equipment.map((item, index) => (
              <SimpleTag key={index} text={item} />
            ))}
          </div>
        </div>
      )}
      
      {/* Description */}
      {description && (
        <div className="mt-4">
          <p className="text-[#AEABBB] text-xs leading-relaxed">
            {description}
          </p>
        </div>
      )}
    </div>
  );
};

export default TagsSection;
