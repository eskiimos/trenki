import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import PWAInit from "@/components/PWAInit";
import OfflineHandler from "@/components/OfflineHandler";
import AppLoader from "@/components/AppLoader";
import MetrikaHits from "@/components/MetrikaHits";
import SubscriptionModal from "@/components/SubscriptionModal";

const overpass = Overpass({
  subsets: ["cyrillic", "latin"],
  variable: "--font-overpass",
});

export const metadata: Metadata = {
  title: "ТРЕНЬКИ — цифровая среда для развития хоккеиста",
  description: "Персональные видеотренировки и упражнения для хоккеистов. Разминка, ОФП, техника, заминка — всё в одном приложении.",
  keywords: ["тренировки для хоккеистов", "хоккей упражнения", "ОФП хоккей", "видеотренировки", "треньки"],
  metadataBase: new URL("https://trenki.app"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ТРЕНЬКИ — цифровая среда для развития хоккеиста",
    description: "Персональные видеотренировки и упражнения для хоккеистов. Разминка, ОФП, техника, заминка — всё в одном приложении.",
    url: "https://trenki.app",
    siteName: "Треньки",
    locale: "ru_RU",
    type: "website",
  },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // middleware кладёт nonce для CSP; в dev (или если middleware не отработал) пустая строка ок.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
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
      </head>
      <body className={`${overpass.variable} antialiased mobile-layout`}>
        {/* Яндекс.Метрика: ДВА счётчика.
            111857547 — счётчик владельца (2026-08-25), с Вебвизором (домен
            верифицирован файлом /yandex_6b3347a71fea8b82.html).
            107768196 — исторический (с 2026-03), оставлен ради непрерывности
            статистики, но Вебвизор на нём ВЫКЛЮЧЕН: два рекордера на одной
            странице конфликтуют и дублируют трафик записи.
            SPA-переходы шлёт MetrikaHits — сам init считает только первую
            загрузку. */}
        <Script id="yandex-metrika" strategy="afterInteractive" nonce={nonce}>
          {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=111857547','ym');
          ym(111857547,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
          ym(107768196,'init',{ssr:true,webvisor:false,clickmap:true,ecommerce:'dataLayer',referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});`}
        </Script>
        <noscript>
          <div>
            <img src="https://mc.yandex.ru/watch/111857547" style={{position:'absolute',left:'-9999px'}} alt="" />
            <img src="https://mc.yandex.ru/watch/107768196" style={{position:'absolute',left:'-9999px'}} alt="" />
          </div>
        </noscript>
        <MetrikaHits />
        <AppLoader />
        <PWAInit />
        <OfflineHandler />
        <OnboardingWrapper>
          <div className="mobile-container">
            {children}
          </div>
        </OnboardingWrapper>
        <SubscriptionModal />
      </body>
    </html>
  );
}
