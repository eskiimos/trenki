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

const TagsSection = () => {
  const tags = [
    'Тип тренировки',
    'Оборудование',
    'Уровень',
    '+15 к потенциалу',
    '+15 к потенциалу',
    'Тренер',
    'И все такое',
  ];

  return (
    <div className="p-4 bg-[#101530]">
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag, index) => (
          <Tag key={index} text={tag} />
        ))}
      </div>
      
      {/* Trainer Info */}
      <div className="flex items-center space-x-3 mb-4">
        <Image 
          src="/images/avatars/trainer-avatar-1.png" 
          alt="Тренер" 
          width={32} 
          height={32}
          className="rounded-full"
        />
        <div>
          <p className="text-white text-sm font-medium">Марк Петров</p>
        </div>
      </div>
      
      {/* Disclaimer */}
      <div className="mt-4">
        <p className="text-[#AEABBB] text-xs leading-relaxed">
          Внимание! Все видео созданы для самостоятельных занятий, и автор контента не несёт ответственности за качество выполнения упражнений занимающимися. Занятия подходят для здоровых людей. Поэтому прислушивайтесь к своим ощущениям, и если вы не уверены в состоянии своего здоровья и возможности выполнения представленных упражнений и асан, то обратитесь ко врачу. Если во время практики почувствуете негативные ощущения, прекратите занятия и также посетите врача. Надеюсь, мои занятия принесут вам только пользу и положительные эмоции. Будьте здоровы и приятных занятий!
        </p>
      </div>
    </div>
  );
};

export default TagsSection;
