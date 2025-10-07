import React from 'react';
import Image from 'next/image';

interface TagProps {
  text: string;
}

const Tag: React.FC<TagProps> = ({ text }) => {
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
}

const TagsSection: React.FC<TagsSectionProps> = ({ 
  tags = [], 
  equipment = [], 
  category, 
  difficulty, 
  level,
  description,
  title,
  trainer 
}) => {
  // Только теги из поля tags
  const allTags = tags.filter(Boolean);

  return (
    <div className="p-4 bg-[#101530]">
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
        </div>
      )}
      
      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map((tag, index) => (
            <Tag key={index} text={tag} />
          ))}
        </div>
      )}
      
      {/* Equipment Section */}
      <div className="bg-[#AEABBB33] rounded-lg p-4 mb-4">
        <h3 className="text-white text-sm font-medium mb-3">ОБОРУДОВАНИЕ</h3>
        {equipment.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {equipment.map((item, index) => (
              <Tag key={index} text={item} />
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
