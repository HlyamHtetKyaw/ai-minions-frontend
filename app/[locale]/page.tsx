import { Link } from '@/i18n/navigation';
import { FEATURES } from '@/features';
import { getTranslations } from 'next-intl/server';
import LandingHowItWorks from '@/features/home/components/landing-how-it-works';
import LandingTrust from '@/features/home/components/landing-trust';
import LandingFaq from '@/features/home/components/landing-faq';
import LandingCta from '@/features/home/components/landing-cta';
import LandingWorkspaceTools from '@/features/home/components/landing-workspace-tools';
import LandingImage from '@/assets/hero_section_img.webp';
import Image from 'next/image';
import { landingHeroBodyFont, landingHeroTitleFont } from '@/lib/landing-hero-fonts';

export default async function HomePage() {
  const tHome = await getTranslations('home');

  return (
    <div className="mx-auto min-w-0 max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
      <section className="mb-12 sm:mb-16 lg:mb-20">
        <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center text-center lg:max-w-6xl">
          <h1
            className={`${landingHeroTitleFont.className} w-full max-w-full text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.06] xl:text-7xl`}
          >
            {tHome('heroTitle')}
          </h1>
          <p
            className={`${landingHeroBodyFont.className} mt-5 w-full max-w-full text-pretty text-base font-normal leading-relaxed text-muted sm:mt-6 sm:text-lg md:max-w-3xl md:text-xl lg:max-w-5xl xl:max-w-6xl`}
          >
            {tHome('heroDescription')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-4">
            <Link
              href="/signup"
              className="landing-home-primary inline-flex min-h-11 min-w-40 items-center justify-center rounded-full px-7 py-3 text-sm font-bold shadow-md"
            >
              {tHome('landing.cta.primary')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 min-w-40 items-center justify-center rounded-full border border-card-border bg-subtle px-7 py-3 text-sm font-semibold text-foreground transition hover:border-accent-gold/40"
            >
              {tHome('landing.cta.secondary')}
            </Link>
          </div>
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-[min(100%,72rem)] sm:mt-14 lg:mt-16">
          <div className="relative aspect-4/3 overflow-hidden rounded-[1.75rem] border border-card-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] sm:aspect-video sm:rounded-4xl">
            <Image
              src={LandingImage}
              alt="AI-powered product preview"
              fill
              priority
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/15 via-transparent to-black/5" />
          </div>
          <div className="absolute -right-1 top-4 z-10 max-w-44 rounded-2xl border border-card-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-sm sm:right-2 sm:top-6 sm:max-w-none sm:px-4 sm:py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Product snapshot
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {FEATURES.length}+ AI tools
            </p>
          </div>
        </div>
      </section>

      <LandingHowItWorks />
      <LandingWorkspaceTools />
      <LandingTrust />
      <LandingFaq />
      <LandingCta />
    </div>
  );
}
