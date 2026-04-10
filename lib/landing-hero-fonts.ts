import { Plus_Jakarta_Sans } from 'next/font/google';
import localFont from 'next/font/local';

/** Landing hero headline — Bold */
export const landingHeroTitleFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
});

/** Landing hero description — Satoshi Regular (local) */
export const landingHeroBodyFont = localFont({
  src: '../assets/fonts/Satoshi-Regular.otf',
  weight: '400',
  style: 'normal',
  display: 'swap',
});
