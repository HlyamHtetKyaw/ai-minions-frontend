import { getTranslations } from 'next-intl/server';
import HeroToolsWorkflow from '@/features/home/components/hero-tools-workflow';

export default async function HeroOverview() {
  const tHome = await getTranslations('home');

  return (
    <section className="relative mb-14 overflow-hidden rounded-[28px] border border-white/10 bg-[#0B0F1A] shadow-2xl shadow-black/50 ring-1 ring-white/5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-36 h-96 w-96 rounded-full bg-purple-500/22 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-pink-500/18 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-blue-500/14 blur-3xl"
      />

      <div className="relative z-10 grid gap-10 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12 lg:p-10">
        <div className="flex flex-col justify-center">
          <h1 className="mb-4 max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.35rem] lg:leading-[1.12]">
            {tHome('toolsPage.heroTitle')}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-white/60 sm:text-lg">
            {tHome('toolsPage.heroDescription')}
          </p>
        </div>

        <HeroToolsWorkflow />
      </div>
    </section>
  );
}
