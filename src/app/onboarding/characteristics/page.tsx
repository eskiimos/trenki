'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Medal } from 'lucide-react';
import { CharacteristicIcon } from '@/components/training/icons';

interface FormData {
  // Самооценка (1-10)
  rawPower: number;
  rawSpeed: number;
  rawEndurance: number;
  rawTechnique: number;
  rawFlexibility: number;
  
  // Вопросы для k_mastery
  yearsInHockey: string;
  trainingFrequency: string;
  matchFrequency: string;
  gameDifficulty: string;
}

export default function CharacteristicsOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    rawPower: 5,
    rawSpeed: 5,
    rawEndurance: 5,
    rawTechnique: 5,
    rawFlexibility: 5,
    yearsInHockey: '',
    trainingFrequency: '',
    matchFrequency: '',
    gameDifficulty: '',
  });

  const handleSliderChange = (field: keyof FormData, value: number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/profile/characteristics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Шаг «куда направим щелчок» убран (август-правки): его ответ
        // (trainingGoals) сервер и раньше игнорировал — цель юзер выбирает
        // перед каждой тренировкой в assessment.
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setShowSuccessModal(true);
        return;
      }

      if (response.status === 401) {
        alert('Сессия истекла. Войдите заново.');
        router.push('/login');
        return;
      }

      alert(data.error || 'Ошибка при сохранении данных');
    } catch (error) {
      console.error('Error submitting characteristics:', error);
      alert('Ошибка при отправке данных');
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step < 2) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col">
      {/* Шапка */}
      <div
        className="px-4 pt-8 pb-3 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)' }}
      >
        {step === 1 && (
          <>
            <h1 className="text-base font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-slate-50 text-center mb-2">
              О СКИЛАХ
            </h1>
            <p className="text-center text-gray-400 text-xs font-medium font-['Overpass'] leading-3 tracking-wide">
              Честно оцени свою текущую форму от 0 до 10
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="text-center text-slate-50 text-base font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
              МАСТЕРСТВО
            </h1>
            <p className="text-center text-gray-400 text-xs font-medium font-['Overpass'] leading-3 tracking-wide">
              Расскажи о своем опыте и уверенности
            </p>
          </>
        )}
      </div>

      <div className="px-0">
        {/* ШАГ 1: Самооценка */}
        {step === 1 && (
          <div className="flex flex-col gap-3">
            {/* Сила */}
            <div className="p-4 bg-zinc-950/20 rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="self-stretch text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-center">
                  <CharacteristicIcon characteristic="ratingPower" size={24} className="inline-block" />
                  <br />СИЛА (броски, силовая игра, единоборства)
                </div>
                <div className="h-11 px-4 py-3 bg-gray-400/20 rounded-[32px] flex justify-center items-center">
                  <div className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                    {formData.rawPower}
                  </div>
                </div>
                <div className="w-full relative h-6">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.rawPower}
                    onChange={(e) => handleSliderChange('rawPower', parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-400/20 rounded-xl appearance-none cursor-pointer slider-custom"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.rawPower - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) ${((formData.rawPower - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Скорость */}
            <div className="p-4 bg-zinc-950/20 rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="self-stretch text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-center">
                  <CharacteristicIcon characteristic="ratingSpeed" size={24} className="inline-block" />
                  <br />СКОРОСТЬ (скорость, маневренность и резкость)
                </div>
                <div className="h-11 px-4 py-3 bg-gray-400/20 rounded-[32px] flex justify-center items-center">
                  <div className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                    {formData.rawSpeed}
                  </div>
                </div>
                <div className="w-full relative h-6">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.rawSpeed}
                    onChange={(e) => handleSliderChange('rawSpeed', parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-400/20 rounded-xl appearance-none cursor-pointer slider-custom"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.rawSpeed - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) ${((formData.rawSpeed - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Выносливость */}
            <div className="p-4 bg-zinc-950/20 rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="self-stretch text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-center">
                  <CharacteristicIcon characteristic="ratingEndurance" size={24} className="inline-block" />
                  <br />ВЫНОСЛИВОСТЬ (играть всю смену, период, матч на максимуме)
                </div>
                <div className="h-11 px-4 py-3 bg-gray-400/20 rounded-[32px] flex justify-center items-center">
                  <div className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                    {formData.rawEndurance}
                  </div>
                </div>
                <div className="w-full relative h-6">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.rawEndurance}
                    onChange={(e) => handleSliderChange('rawEndurance', parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-400/20 rounded-xl appearance-none cursor-pointer slider-custom"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.rawEndurance - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) ${((formData.rawEndurance - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Техника */}
            <div className="p-4 bg-zinc-950/20 rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="self-stretch text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-center">
                  <CharacteristicIcon characteristic="ratingTechnique" size={24} className="inline-block" />
                  <br />ТЕХНИКА (точность паса, контроль шайбы)
                </div>
                <div className="h-11 px-4 py-3 bg-gray-400/20 rounded-[32px] flex justify-center items-center">
                  <div className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                    {formData.rawTechnique}
                  </div>
                </div>
                <div className="w-full relative h-6">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.rawTechnique}
                    onChange={(e) => handleSliderChange('rawTechnique', parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-400/20 rounded-xl appearance-none cursor-pointer slider-custom"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.rawTechnique - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) ${((formData.rawTechnique - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Гибкость */}
            <div className="p-4 bg-zinc-950/20 rounded-3xl">
              <div className="flex flex-col items-center gap-4">
                <div className="self-stretch text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide text-center">
                  <CharacteristicIcon characteristic="ratingFlexibility" size={24} className="inline-block" />
                  <br />ГИБКОСТЬ (пластичность, устойчивость, маневренность)
                </div>
                <div className="h-11 px-4 py-3 bg-gray-400/20 rounded-[32px] flex justify-center items-center">
                  <div className="text-slate-50 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                    {formData.rawFlexibility}
                  </div>
                </div>
                <div className="w-full relative h-6">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={formData.rawFlexibility}
                    onChange={(e) => handleSliderChange('rawFlexibility', parseInt(e.target.value))}
                    className="w-full h-4 bg-gray-400/20 rounded-xl appearance-none cursor-pointer slider-custom"
                    style={{
                      background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((formData.rawFlexibility - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) ${((formData.rawFlexibility - 1) / 9) * 100}%, rgba(156, 163, 175, 0.2) 100%)`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ШАГ 2: Мастерство (все 4 вопроса) */}
        {step === 2 && (
          <div className="px-4 py-6 flex flex-col gap-8">
            {/* Сколько лет в хоккее */}
            <div className="flex flex-col gap-4">
              <div className="text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                Сколько лет занимаешься хоккеем?
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'LESS_THAN_1', label: '<1 года' },
                  { value: '1_TO_3', label: '1-3 года' },
                  { value: '3_TO_5', label: '3-5 лет' },
                  { value: 'MORE_THAN_5', label: '>5 лет' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('yearsInHockey', option.value)}
                    className={`h-11 px-4 py-3 rounded-[32px] flex justify-center items-center transition ${
                      formData.yearsInHockey === option.value
                        ? 'bg-[#A1FF4A] text-slate-950'
                        : 'bg-gray-400/20 text-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Частота тренировок */}
            <div className="flex flex-col gap-4">
              <div className="text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                Как часто тренируешься? (На льду и на земле, с командой и дополнительно)
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'ONCE_A_WEEK', label: 'раз в неделю / реже' },
                  { value: '2_TO_4_TIMES', label: '2-4 раза в неделю' },
                  { value: 'ALMOST_DAILY', label: 'почти каждый день' },
                  { value: 'SEVERAL_TIMES_DAILY', label: 'несколько раз в день' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('trainingFrequency', option.value)}
                    className={`h-11 px-4 py-3 rounded-[32px] flex justify-center items-center transition ${
                      formData.trainingFrequency === option.value
                        ? 'bg-[#A1FF4A] text-slate-950'
                        : 'bg-gray-400/20 text-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Частота матчей */}
            <div className="flex flex-col gap-4">
              <div className="text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                Как часто играешь матчи?
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'NO_MATCHES', label: 'не играю, только тренируюсь' },
                  { value: 'FEW_PER_MONTH', label: 'пару раз в месяц' },
                  { value: 'ONCE_A_WEEK', label: 'раз в неделю' },
                  { value: 'SEVERAL_PER_WEEK', label: 'несколько раз в неделю' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('matchFrequency', option.value)}
                    className={`h-11 px-4 py-3 rounded-[32px] flex justify-center items-center transition ${
                      formData.matchFrequency === option.value
                        ? 'bg-[#A1FF4A] text-slate-950'
                        : 'bg-gray-400/20 text-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Уверенность в игровых ситуациях */}
            <div className="flex flex-col gap-4">
              <div className="text-slate-50 text-xs font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                Оцени свою уверенность в игровых ситуациях (единоборства, обводка, игра в пас и тд)
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'VERY_HARD', label: 'чаще проигрываю, есть над чем работать' },
                  { value: 'HARD', label: 'нормально, я конкурирую' },
                  { value: 'ADVANTAGE', label: 'чувствую свое преимущество в большинстве случаев' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleSelectChange('gameDifficulty', option.value)}
                    className={`h-11 px-4 py-3 rounded-[32px] flex justify-center items-center transition ${
                      formData.gameDifficulty === option.value
                        ? 'bg-[#A1FF4A] text-slate-950'
                        : 'bg-gray-400/20 text-slate-50'
                    }`}
                  >
                    <div className="text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                      {option.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Шаг 3: Выбор целей */}
      </div>

      {/* Нижняя панель */}
      <div className="w-full px-4 py-6 bg-slate-900 flex flex-col gap-6">
        {step === 1 && (
          <>
            <button
              onClick={nextStep}
              className="w-full h-12 px-6 py-3 bg-[#A1FF4A] rounded-[32px] flex justify-center items-center hover:bg-[#90E841] transition"
            >
              <div className="text-slate-950 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                ДАЛЕЕ
              </div>
            </button>
            <div className="text-center text-gray-400 text-xs font-medium font-['Overpass'] leading-3 tracking-wide">
              1/2
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <button
              onClick={handleSubmit}
              disabled={!formData.yearsInHockey || !formData.trainingFrequency || !formData.matchFrequency || !formData.gameDifficulty || isSubmitting}
              className="w-full h-12 px-6 py-3 bg-[#A1FF4A] rounded-[32px] flex justify-center items-center hover:bg-[#90E841] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-slate-950 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                {isSubmitting ? 'СОХРАНЕНИЕ...' : 'поехали тренироваться!'}
              </div>
            </button>
            <div className="text-center text-gray-400 text-xs font-medium font-['Overpass'] leading-3 tracking-wide">
              2/2
            </div>
          </>
        )}
      </div>

      {/* Модальное окно успешного завершения */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-80 px-4 py-6 bg-indigo-500 rounded-2xl inline-flex flex-col justify-start items-center gap-4">
            {/* Медаль */}
            <div className="flex justify-center text-black">
              <Medal size={28} />
            </div>

            {/* Текст */}
            <div className="self-stretch text-center justify-start text-slate-50 text-2xl font-bold font-['Overpass'] leading-6">
              Да ты жаждешь побед! Так держать!
            </div>

            {/* Кнопка */}
            <div 
              onClick={() => router.push('/')}
              className="self-stretch h-12 px-6 py-3 bg-[#A1FF4A] rounded-[32px] inline-flex justify-center items-center gap-2.5 cursor-pointer hover:bg-[#90E841] transition"
            >
              <div className="justify-center text-slate-950 text-sm font-bold font-['Overpass'] uppercase leading-4 tracking-wide">
                поехали тренироваться!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
