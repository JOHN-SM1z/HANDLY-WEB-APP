import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@handly/ui/tokens.css';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: {
    default: 'Handly — Uyingiz uchun ishonchli ustalar',
    template: '%s · Handly',
  },
  description:
    'Handly — uy xizmatlari uchun ishonchli, tasdiqlangan ustalar. Santexnik, elektrik, konditsioner va boshqa xizmatlar.',
  applicationName: 'Handly',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#14161a' },
  ],
};

// Apply a saved theme before paint to avoid a flash (toggle lands in a later milestone).
const themeScript = `(function(){try{var t=localStorage.getItem('handly-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
