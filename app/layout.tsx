import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { BottomNav } from '@/components/navigation/bottom-nav'
import { AppProviders } from '@/components/providers/app-providers'
import { ToastContainer } from '@/components/toast/smart-toast'
import { BodyCleanup } from '@/components/providers/body-cleanup'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export const metadata: Metadata = {
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
        url: '/apple-icon.png',
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
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/apple-icon.png',
    other: [
      {
        url: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        url: '/icon-light-32x32.png',
        sizes: '32x32',
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
      <body className="font-sans antialiased">
        <AppProviders>
          <BodyCleanup />
          {children}
          <BottomNav />
          <ToastContainer />
        </AppProviders>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
