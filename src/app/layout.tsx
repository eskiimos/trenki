import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import TelegramProvider from "@/components/TelegramProvider";

const overpass = Overpass({
  subsets: ["cyrillic", "latin"],
  variable: "--font-overpass",
});

export const metadata: Metadata = {
  title: "Trenki - Тренировки",
  description: "Мини-приложение для тренировок в Telegram",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className={`${overpass.variable} antialiased`} style={{ fontFamily: 'var(--font-overpass), Overpass, Arial, sans-serif' }}>
        <TelegramProvider>
          {children}
        </TelegramProvider>
      </body>
    </html>
  );
}
