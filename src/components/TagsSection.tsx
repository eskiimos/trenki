import React from 'react';
import Image from 'next/image';

interface TagProps {
  text: string;
}

const Tag: React.FC<TagProps> = ({ text }) => {
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
  trainer?: {
    name: string;
    lastName: string;
    avatar: string | null;
  } | null;
}

const TagsSection: React.FC<TagsSectionProps> = ({ 
  tags = [], 
  equipment = [], 
  category, 
  difficulty, 
  level,
  description,
  trainer 
}) => {
  // Собираем все теги в один массив
  const allTags = [
    ...(category ? [category] : []),
    ...(difficulty ? [difficulty] : []),
    ...(level ? [level] : []),
    ...tags,
    ...equipment,
  ].filter(Boolean);

  return (
    <div className="p-4 bg-[#101530]">
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map((tag, index) => (
            <Tag key={index} text={tag} />
          ))}
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
