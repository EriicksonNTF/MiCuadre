import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { AppProviders } from '@/components/providers/app-providers'
import { ToastContainer } from '@/components/toast/smart-toast'
import { BodyCleanup } from '@/components/providers/body-cleanup'
import { OfflineStatusBanner } from '@/components/ui/offline-status-banner'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import './globals.css'

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
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
    <html lang="es" className="bg-background">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AppProviders bodyCleanup={<BodyCleanup />} offlineBanner={<OfflineStatusBanner />} toastContainer={<ToastContainer />}>
          {children}
        </AppProviders>
        <BottomNav />
        {process.env.NODE_ENV === 'production' && <ServiceWorkerRegister />}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
