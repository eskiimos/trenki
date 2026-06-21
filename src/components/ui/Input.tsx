import React from 'react';

// Единое поле ввода. Канон: фон #060919, hairline-рамка, лайм-фокус, текст
// #F9F8FE, плейсхолдер #AEABBB. pill=true — для строки поиска (radius 999).
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  pill?: boolean;
}

export default function Input({ pill = false, style, className = '', ...rest }: InputProps) {
  return (
    <input
      className={`ui-input font-overpass ${className}`.trim()}
      style={{
        background: 'var(--color-night)',
        border: '1px solid var(--border-hairline)',
        borderRadius: pill ? 'var(--radius-pill)' : 'var(--radius-md)',
        padding: '12px 14px',
        fontSize: 14,
        color: 'var(--color-ink)',
        width: '100%',
        ...style,
      }}
      {...rest}
    />
  );
}
