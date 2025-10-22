import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import "./globals.css";
import TelegramProvider from "@/components/TelegramProvider";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import PWAInit from "@/components/PWAInit";
import OfflineHandler from "@/components/OfflineHandler";
import AppLoader from "@/components/AppLoader";

const overpass = Overpass({
  subsets: ["cyrillic", "latin"],
  variable: "--font-overpass",
});

export const metadata: Metadata = {
  title: "Треньки - Тренировки для хоккеистов",
  description: "Персональные тренировки и упражнения для хоккеистов",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Треньки",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
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
        <meta name="theme-color" content="#445CFF" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icons/icon-app.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </head>
      <body className={`${overpass.variable} antialiased mobile-layout`}>
        <AppLoader />
        <PWAInit />
        <OfflineHandler />
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
