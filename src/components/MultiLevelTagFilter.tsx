'use client';

import { useState, useEffect } from 'react';

interface Tag {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  tagType: string;
  icon: string | null;
  color: string | null;
  order: number;
}

interface MultiLevelTagFilterProps {
  selectedTags?: string[];
  onTagsChange?: (tags: string[]) => void;
}

export default function MultiLevelTagFilter({ 
  selectedTags = [], 
  onTagsChange 
}: MultiLevelTagFilterProps) {
  const [activeCategory, setActiveCategory] = useState<string>('load');
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    { key: 'load', label: 'Тип нагрузки', icon: '⚡' },
    { key: 'muscle', label: 'Группы мышц', icon: '💪' },
    { key: 'complexity', label: 'Сложность', icon: '🎯' },
    { key: 'goal', label: 'Цель', icon: '🎪' },
  ];

  useEffect(() => {
    fetchTags();
  }, [activeCategory]);

  const fetchTags = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tags?type=${activeCategory}`);
      const data = await response.json();
      setTags(data);
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tagName: string) => {
    if (!onTagsChange) return;

    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName));
    } else {
      onTagsChange([...selectedTags, tagName]);
    }
  };

  return (
    <div className="bg-[#1a1f3a] rounded-xl p-4">
      {/* Категории */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-gray-700 hide-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 flex items-center gap-2
              ${activeCategory === cat.key
                ? 'bg-[#A1FF4A] text-[#060919]'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }
            `}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Теги выбранной категории */}
      {loading ? (
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 h-10 w-32 bg-gray-700 rounded-full animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag.name);
            
            return (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.name)}
                className={`
                  flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium
                  transition-all duration-200 flex items-center gap-2
                  ${isSelected 
                    ? 'text-white shadow-lg scale-105 ring-2 ring-white/20' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105'
                  }
                `}
                style={{
                  backgroundColor: isSelected ? tag.color || '#A1FF4A' : undefined,
                }}
                title={tag.description || undefined}
              >
                {tag.icon && <span className="text-lg">{tag.icon}</span>}
                <span>{tag.displayName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Выбранные теги (счетчик) */}
      {selectedTags.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">
              Выбрано фильтров: <span className="text-[#A1FF4A] font-semibold">{selectedTags.length}</span>
            </span>
            <button
              onClick={() => onTagsChange?.([])}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Сбросить всё
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
