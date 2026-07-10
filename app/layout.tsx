import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Instrument_Serif, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { Analytics } from '@vercel/analytics/react'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { SideNav } from '@/components/navigation/side-nav'
import { AppProviders } from '@/components/providers/app-providers'
import { ToastContainer } from '@/components/toast/smart-toast'
import { BodyCleanup } from '@/components/providers/body-cleanup'
import { OfflineStatusBanner } from '@/components/ui/offline-status-banner'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { ThemeColor } from '@/components/providers/theme-color'
import { MainContent } from '@/components/providers/main-content'
import './globals.css'

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument-serif", weight: "400", style: ["normal", "italic"] })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  minimumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://micuadre.app'),
  applicationName: 'MiCuadre',
  title: 'MiCuadre - Tus finanzas simplificadas',
  description: 'App de finanzas personales en pesos dominicanos',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MiCuadre',
    startupImage: [
      {
        url: '/apple-touch-icon.png',
        media: '(device-width: 768px)',
      },
    ],
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: '16x16 32x32 48x48',
        type: 'image/x-icon',
      },
      {
        url: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
    ],
    apple: '/apple-touch-icon.png',
    other: [
      {
        url: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#fafaf9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#12121a" media="(prefers-color-scheme: dark)" />
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("micuadre-theme");if(!t)t="system";if(t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`}
        </Script>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AppProviders bodyCleanup={<BodyCleanup />} offlineBanner={<OfflineStatusBanner />} toastContainer={<ToastContainer />}>
          <SideNav />
          <MainContent>
            {children}
          </MainContent>
        </AppProviders>
        <BottomNav />
        {process.env.NODE_ENV === 'production' && <ServiceWorkerRegister />}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
