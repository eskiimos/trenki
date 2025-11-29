'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

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
    <div className="bg-[#AEABBB33] text-[#AEABBB] text-xs rounded-full px-4 py-2">
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
    name: string;
    lastName: string;
    avatar: string | null;
  } | null;
  // Новые пропсы для интерактивных тегов
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  multiSelect?: boolean;
  showFilterTags?: boolean; // показывать теги из базы для фильтрации
  tagFilterType?: 'load' | 'muscle' | 'complexity' | 'goal' | 'all'; // тип тегов для фильтрации
  gainTag?: React.ReactNode;
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
  selectedTags = [],
  onTagsChange,
  multiSelect = true,
  showFilterTags = false,
  tagFilterType = 'all',
  gainTag,
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

      {/* Trainer Info */}
      {trainer && (
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#2d3448] flex items-center justify-center">
            {trainer.avatar ? (
              <Image 
                src={trainer.avatar} 
                alt={trainer.name} 
                width={32} 
                height={32}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white text-sm font-semibold">
                {trainer.name.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <p className="text-white text-sm font-medium">
              {trainer.name} {trainer.lastName}
            </p>
          </div>
        </div>
      )}
      
      {/* Video Title */}
      {title && (
        <div className="mb-4">
          <h2 className="text-white text-lg font-semibold leading-snug">
            {title}
          </h2>
          {gainTag && (
            <div className="mt-2">
              {gainTag}
            </div>
          )}
        </div>
      )}
      
      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map((tag, index) => (
            <SimpleTag key={index} text={tag} />
          ))}
        </div>
      )}
      
      {/* Equipment Section */}
      <div className="bg-[#AEABBB33] rounded-lg p-4 mb-4">
        <h3 className="text-white text-sm font-medium mb-3">ОБОРУДОВАНИЕ</h3>
        {equipment.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {equipment.map((item, index) => (
              <SimpleTag key={index} text={item} />
            ))}
          </div>
        )}
      </div>
      
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
