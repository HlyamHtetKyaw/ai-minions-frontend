import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import "@/app/globals.css"
import Header from '@/components/layout/header';
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
              <main className="min-w-0">{children}</main>
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
