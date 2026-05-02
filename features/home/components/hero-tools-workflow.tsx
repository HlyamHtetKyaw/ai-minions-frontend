'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Languages, Mic, Sparkles, UploadCloud } from 'lucide-react';

const STEP_THEMES = [
  {
    circleShadow: 'shadow-[0_0_28px_-6px_rgba(168,85,247,0.85)]',
    circleBorder: 'border-violet-400/60',
    ring: 'ring-violet-500/30',
    iconBg:
      'bg-linear-to-br from-violet-500 via-purple-600 to-indigo-700 shadow-[0_8px_32px_-8px_rgba(139,92,246,0.65)]',
    sparkle: 'text-violet-300',
    cardTint:
      'border-white/10 bg-linear-to-b from-violet-500/[0.14] via-[#0B0F1A]/95 to-[#070a12] backdrop-blur-md',
    hoverGlow:
      'group-hover:shadow-[0_0_48px_-12px_rgba(139,92,246,0.45)]',
  },
  {
    circleShadow: 'shadow-[0_0_28px_-6px_rgba(56,189,248,0.75)]',
    circleBorder: 'border-sky-400/55',
    ring: 'ring-sky-400/25',
    iconBg:
      'bg-linear-to-br from-sky-500 via-blue-600 to-indigo-700 shadow-[0_8px_32px_-8px_rgba(14,165,233,0.55)]',
    sparkle: 'text-sky-300',
    cardTint:
      'border-white/10 bg-linear-to-b from-sky-500/[0.14] via-[#0B0F1A]/95 to-[#070a12] backdrop-blur-md',
    hoverGlow:
      'group-hover:shadow-[0_0_48px_-12px_rgba(56,189,248,0.4)]',
  },
  {
    circleShadow: 'shadow-[0_0_28px_-6px_rgba(244,114,182,0.8)]',
    circleBorder: 'border-fuchsia-400/55',
    ring: 'ring-fuchsia-400/25',
    iconBg:
      'bg-linear-to-br from-fuchsia-500 via-rose-600 to-orange-600 shadow-[0_8px_32px_-8px_rgba(236,72,153,0.55)]',
    sparkle: 'text-fuchsia-300',
    cardTint:
      'border-white/10 bg-linear-to-b from-fuchsia-500/[0.14] via-[#0B0F1A]/95 to-[#070a12] backdrop-blur-md',
    hoverGlow:
      'group-hover:shadow-[0_0_48px_-12px_rgba(236,72,153,0.42)]',
  },
] as const;

export default function HeroToolsWorkflow() {
  const t = useTranslations('home.toolsPage.workflow');
  const gid = useId().replace(/:/g, '');

  const steps = [
    {
      Icon: Mic,
      title: t('step1Title'),
      description: t('step1Description'),
      extras: null as ReactNode,
    },
    {
      Icon: Languages,
      title: t('step2Title'),
      description: t('step2Description'),
      extras: null as ReactNode,
    },
    {
      Icon: UploadCloud,
      title: t('step3Title'),
      description: t('step3Description'),
      extras: (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 shadow-md shadow-black/40 ring-2 ring-[#0B0F1A]">
          <BadgeCheck className="h-3 w-3 text-white" strokeWidth={2.5} aria-hidden />
        </span>
      ),
    },
  ];

  return (
    <div className="relative min-w-0">
      {/* Desktop: dashed gradient spine + numbered nodes */}
      <div className="relative mx-auto mb-7 hidden h-14 max-w-4xl lg:block">
        <svg
          className="absolute inset-x-[10%] top-1/2 h-10 w-[80%] -translate-y-1/2 overflow-visible"
          viewBox="0 0 800 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${gid}-pipe`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(192,132,252)" stopOpacity="0.85" />
              <stop offset="50%" stopColor="rgb(56,189,248)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="rgb(244,114,182)" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <line
            x1="32"
            y1="24"
            x2="768"
            y2="24"
            stroke={`url(#${gid}-pipe)`}
            strokeWidth="2"
            strokeDasharray="7 12"
            strokeLinecap="round"
            vectorEffect="nonScalingStroke"
          />
        </svg>
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-[8%]">
          {[1, 2, 3].map((n, i) => (
            <div
              key={n}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-[#0B0F1A] text-sm font-bold text-white ring-2 ${STEP_THEMES[i].ring} ${STEP_THEMES[i].circleBorder} ${STEP_THEMES[i].circleShadow}`}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:gap-7 lg:grid-cols-3 lg:gap-6 xl:gap-8">
        {steps.map((step, i) => {
          const theme = STEP_THEMES[i];
          const Icon = step.Icon;
          return (
            <div key={i} className="relative flex flex-col">
              {/* Mobile step rail */}
              <div className="mb-3 flex items-center gap-3 lg:hidden">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-[#0B0F1A] text-xs font-bold text-white ring-2 ${theme.ring} ${theme.circleBorder} ${theme.circleShadow}`}
                >
                  {i + 1}
                </div>
                {i < 2 ? (
                  <div className="h-px flex-1 bg-linear-to-r from-purple-400/45 via-sky-400/45 to-pink-400/45 opacity-80 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]" />
                ) : null}
              </div>

              <div
                className={`group relative flex flex-1 flex-col overflow-hidden rounded-3xl border p-5 transition-[transform,box-shadow] duration-300 ease-out hover:scale-[1.02] sm:p-6 ${theme.cardTint} ${theme.hoverGlow} hover:shadow-xl`}
              >
                <div className="relative mb-4 inline-flex">
                  <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl ${theme.iconBg}`}
                  >
                    <Icon className="h-7 w-7 text-white drop-shadow-md" strokeWidth={2} aria-hidden />
                    {step.extras}
                  </div>
                  <Sparkles
                    className={`absolute -right-1 -top-1 h-4 w-4 ${theme.sparkle} opacity-90`}
                    aria-hidden
                  />
                  <Sparkles
                    className={`absolute -right-3 top-2 h-3 w-3 ${theme.sparkle} opacity-70`}
                    aria-hidden
                  />
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
