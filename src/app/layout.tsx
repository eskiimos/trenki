import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import TelegramProvider from "@/components/TelegramProvider";
import OnboardingWrapper from "@/components/OnboardingWrapper";

const overpass = Overpass({
  subsets: ["cyrillic", "latin"],
  variable: "--font-overpass",
});

export const metadata: Metadata = {
  title: "Trenki - Тренировки",
  description: "Мини-приложение для тренировок в Telegram",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className={`${overpass.variable} antialiased mobile-layout`}>
        <TelegramProvider>
          <OnboardingWrapper>
            <div className="mobile-container">
              {children}
            </div>
          </OnboardingWrapper>
        </TelegramProvider>
      </body>
    </html>
  );
}
