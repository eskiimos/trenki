import type { Metadata } from "next";
import { Overpass } from "next/font/google";
import Script from "next/script";
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
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`(function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
          })(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=107768196','ym');
          ym(107768196,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});`}
        </Script>
        <noscript>
          <div><img src="https://mc.yandex.ru/watch/107768196" style={{position:'absolute',left:'-9999px'}} alt="" /></div>
        </noscript>
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
