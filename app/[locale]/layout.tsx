import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import "@/app/globals.css"
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { VerificationRedirect } from '@/components/auth/verification-redirect';
import ThemeProvider from '@/components/theme/theme-provider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'AI Minions — AI-powered media tools',
  description: 'Caption, translate, transcribe, and edit video content with AI.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen min-w-0 overflow-x-clip text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <div className="app-gradient min-w-0 w-full overflow-x-clip">
              <VerificationRedirect />
              <Header />
              <main className="min-w-0 w-full overflow-x-clip">
                {/* Same horizontal track as `HeaderShell` glass row: no extra outer gutter */}
                <div className="mx-auto min-w-0 w-full max-w-7xl px-4 sm:px-5">
                  {children}
                </div>
              </main>
              <Footer />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
