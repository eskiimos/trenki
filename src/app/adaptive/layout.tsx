import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'АДАПТИВ — тренировки для адаптивного спорта',
  description: 'Специализированные тренировки и аналитика для адаптивного спорта. Шкалы FIM/CARS, персональные программы.',
  metadataBase: new URL('https://adaptive.trenki.app'),
  openGraph: {
    title: 'АДАПТИВ — тренировки для адаптивного спорта',
    description: 'Специализированные тренировки и аналитика для адаптивного спорта.',
    url: 'https://adaptive.trenki.app',
    siteName: 'Адаптив',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function AdaptiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-[#060919] text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
