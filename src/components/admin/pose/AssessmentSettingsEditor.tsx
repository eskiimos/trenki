'use client';

import { inputStyle } from '@/components/admin/ui';
import {
  ASSESSMENT_ANGLES, ASSESSMENT_ANGLE_LABELS, ASSESSMENT_PROFILES, assessmentPreset,
  type AssessmentSettings, type AssessmentProfile,
} from '@/lib/pose/assessment-settings';

export default function AssessmentSettingsEditor({ value, onChange }: {
  value: AssessmentSettings;
  onChange: (value: AssessmentSettings) => void;
}) {
  return <div className="flex flex-col gap-3">
    <label style={{ fontSize: 13 }}>Профиль упражнения
      <select aria-label="Профиль упражнения" value={value.profile} style={{ ...inputStyle, marginTop: 6 }} onChange={(e) => {
        const profile = e.target.value as AssessmentProfile;
        if (profile !== 'custom') onChange(assessmentPreset(profile));
      }}>
        {Object.entries(ASSESSMENT_PROFILES).map(([id, label]) => <option key={id} value={id} disabled={id === 'custom'}>{label}</option>)}
      </select>
    </label>
    <label style={{ fontSize: 13 }}>Допуск отклонения: {value.toleranceDeg}°
      <input aria-label="Допуск отклонения" type="range" min={0} max={30} step={1} value={value.toleranceDeg}
        style={{ width: '100%', appearance: 'auto', WebkitAppearance: 'slider-horizontal', accentColor: 'var(--color-brand)' }}
        onChange={(e) => onChange({ ...value, profile: 'custom', toleranceDeg: Number(e.target.value) })} />
    </label>
    <p style={{ color: 'var(--color-muted)', fontSize: 12, margin: 0 }}>
      Отклонения в пределах допуска не снижают сходство. Дальше оценка плавно уменьшается до нуля за следующие 60°.
      Пороги экспериментальные и требуют проверки тренером.
    </p>
    <details>
      <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Важность и обязательная видимость суставов</summary>
      <p style={{ color: 'var(--color-muted)', fontSize: 12 }}>Важность от 0 до 5; 0 исключает сустав. Без обязательного сустава оценка не показывается.</p>
      <div className="flex flex-col gap-2">
        {ASSESSMENT_ANGLES.map((key) => <div key={key} className="flex items-center gap-3 flex-wrap" style={{ fontSize: 13 }}>
          <label className="flex items-center gap-2" style={{ flex: 1, minWidth: 180 }}>
            {ASSESSMENT_ANGLE_LABELS[key]}
            <input aria-label={`Важность: ${ASSESSMENT_ANGLE_LABELS[key]}`} type="number" min={0} max={5} step={0.25} value={value.weights[key]}
              style={{ ...inputStyle, width: 80 }} onChange={(e) => {
                const weight = Number(e.target.value);
                onChange({ ...value, profile: 'custom', weights: { ...value.weights, [key]: weight },
                  requiredAngles: weight > 0 ? value.requiredAngles : value.requiredAngles.filter((angle) => angle !== key) });
              }} />
          </label>
          <label className="flex items-center gap-2" style={{ minHeight: 44 }}>
            <input aria-label={`Обязателен: ${ASSESSMENT_ANGLE_LABELS[key]}`} type="checkbox" disabled={value.weights[key] <= 0}
              style={{ appearance: 'auto', WebkitAppearance: 'checkbox', accentColor: 'var(--color-brand)', width: 20, height: 20, margin: 0, flexShrink: 0 }}
              checked={value.requiredAngles.includes(key)} onChange={(e) => onChange({ ...value, profile: 'custom',
                requiredAngles: e.target.checked ? [...value.requiredAngles, key] : value.requiredAngles.filter((angle) => angle !== key),
              })} /> Обязателен
          </label>
        </div>)}
      </div>
    </details>
  </div>;
}
