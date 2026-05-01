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
import { ArrowUpRight, Play } from 'lucide-react';

export default async function HomePage() {
  const tHome = await getTranslations('home');

  return (
    <div className="min-w-0 pb-16 pt-8 sm:pb-24 sm:pt-12">
      <section className="mb-12 overflow-x-clip sm:mb-16 lg:mb-20">
        <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
          <div>
            <h1
              className={`${landingHeroTitleFont.className} text-balance text-4xl font-bold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-6xl xl:text-7xl`}
            >
              {tHome('heroTitle')}
            </h1>
            <p
              className={`${landingHeroBodyFont.className} mt-5 max-w-xl text-pretty text-base font-normal leading-relaxed text-muted sm:text-lg lg:text-xl`}
            >
              {tHome('heroDescription')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                href="/signup"
                className="landing-home-primary inline-flex min-h-11 min-w-40 items-center justify-center rounded-full px-7 py-3 text-sm font-bold shadow-md"
              >
                {tHome('landing.cta.primary')}
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-11 min-w-40 items-center justify-center gap-1 rounded-full border border-card-border bg-subtle px-7 py-3 text-sm font-semibold text-foreground transition hover:border-accent-gold/40"
              >
                {tHome('landing.cta.secondary')}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto min-w-0 w-full max-w-136 overflow-x-clip lg:justify-self-end">
            <div className="relative aspect-4/5 overflow-hidden rounded-4xl border border-card-border bg-card shadow-[0_24px_80px_-24px_rgba(0,0,0,0.35)] sm:aspect-5/6">
              <div className="absolute inset-x-[8%] top-[7%] h-[26%] rounded-3xl bg-linear-to-br from-accent-gold/70 via-accent-gold/35 to-accent-purple/25 blur-2xl" />
              <div className="absolute inset-4 sm:inset-5">
                <Image
                  src={LandingImage}
                  alt="AI-powered product preview"
                  fill
                  priority
                  className="object-contain object-center"
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-transparent" />
              <div
                className="absolute left-1/2 top-1/2 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-card/95 text-foreground shadow-lg backdrop-blur-sm"
                aria-hidden="true"
              >
                <Play className="ml-0.5 h-5 w-5 fill-foreground text-foreground" />
              </div>
            </div>

            <div className="absolute -left-3 top-8 rounded-full border border-card-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg sm:-left-6 sm:top-10">
              Auto subtitles
            </div>
            <div className="absolute left-8 top-20 rounded-full border border-card-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg sm:left-14 sm:top-24">
              Translate in Burmese
            </div>
            <div className="absolute left-14 top-32 rounded-full border border-card-border bg-card px-3 py-2 text-xs font-medium text-foreground shadow-lg sm:left-24 sm:top-36">
              Viral Video Generation
            </div>

            <div className="absolute right-3 top-4 rounded-2xl border border-card-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:right-6 sm:top-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">WORKFLOW</p>
              <p className="mt-1 text-xl font-bold leading-none text-foreground">Transcribe</p>
              <p className="mt-1 text-xs text-muted">Translate and edit in one studio</p>
            </div>

            <div className="absolute -bottom-7 left-2 rounded-2xl border border-card-border bg-card px-3 py-2 text-xs font-semibold text-muted shadow sm:left-4">
              {FEATURES.length}+ tools ready
            </div>
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
