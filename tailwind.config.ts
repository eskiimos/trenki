import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'overpass': ['var(--font-overpass)', 'Overpass', 'Arial', 'sans-serif'],
        'russo': ['Russo One', 'cursive'],
      },
      // Цвета-токены живут в src/app/globals.css в блоке @theme (Tailwind 4):
      // --color-night/surface/elevated/brand/brand-blue/ink/muted/danger.
      // Здесь не дублируем — этот JS-конфиг в v4 без @config всё равно не грузится.
      maxWidth: {
        'mobile': '428px',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-top': 'env(safe-area-inset-top)',
      },
      screens: {
        'mobile': '428px',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        pingOnce: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.15)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'ping-once': 'pingOnce 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;