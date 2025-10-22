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
  onApply?: () => void; // Новый проп для применения фильтров
  showApplyButton?: boolean; // Показывать ли кнопку применить
}

export default function MultiLevelTagFilter({ 
  selectedTags = [], 
  onTagsChange,
  onApply,
  showApplyButton = false
}: MultiLevelTagFilterProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    { key: 'LOAD', label: 'ТИП ТРЕНИРОВКИ' },
    { key: 'LOAD_TYPE', label: 'ТИП НАГРУЗКИ' },
    { key: 'MUSCLE', label: 'НАПРАВЛЕНИЕ НАГРУЗКИ' },
    { key: 'GOAL', label: 'СОСТОЯНИЕ' },
    { key: 'EQUIPMENT', label: 'ОБОРУДОВАНИЕ' },
    { key: 'COMPLEXITY', label: 'СЛОЖНОСТЬ' },
    { key: 'TRAINER', label: 'ТРЕНЕР' },
  ];

  useEffect(() => {
    fetchAllTags();
  }, []);

  const fetchAllTags = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAllTags(data);
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

  const getTagsByType = (type: string) => {
    return allTags.filter(tag => tag.tagType === type);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(5)].map((_, i) => (
          <div key={i}>
            <div className="h-4 w-32 bg-gray-700 rounded mb-3 animate-pulse" />
            <div className="flex flex-wrap gap-2">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-10 w-24 bg-gray-700 rounded-full animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categoryTags = getTagsByType(category.key);
        
        if (categoryTags.length === 0) return null;
        
        return (
          <div key={category.key}>
            {/* Заголовок категории */}
            <h3 
              className="mb-3 uppercase"
              style={{
                fontFamily: 'Overpass, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                lineHeight: '120%',
                letterSpacing: '0.5px',
                color: '#F9F8FE',
              }}
            >
              {category.label}
            </h3>
            
            {/* Теги категории */}
            <div className="flex flex-wrap" style={{ gap: '16px' }}>
              {categoryTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagClick(tag.name)}
                    className="uppercase transition-all duration-200 hover:scale-105"
                    style={{
                      height: '44px',
                      paddingTop: '12px',
                      paddingRight: '16px',
                      paddingBottom: '12px',
                      paddingLeft: '16px',
                      borderRadius: '32px',
                      backgroundColor: isSelected ? '#A1FF4A' : '#AEABBB33',
                      color: isSelected ? '#060919' : '#F9F8FE',
                      fontFamily: 'Overpass, sans-serif',
                      fontWeight: 700,
                      fontSize: '14px',
                      lineHeight: '120%',
                      letterSpacing: '0.5px',
                      textAlign: 'center',
                      opacity: 1,
                      whiteSpace: 'nowrap',
                    }}
                    title={tag.description || undefined}
                  >
                    {tag.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
