import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import contentGenerationSvg from '@/assets/content_generation_svg.svg';
import transcribeSvg from '@/assets/transcribe_svg.svg';
import videoUploadSvg from '@/assets/video_upload_svg.svg';

const STEP_KEYS = ['video-upload', 'transcribe', 'content-generation'] as const;

const STEP_IMAGES = [
  { src: videoUploadSvg, width: 558, height: 391 },
  { src: transcribeSvg, width: 1295, height: 816 },
  { src: contentGenerationSvg, width: 1295, height: 816 },
] as const;

export default async function LandingHowItWorks() {
  const tHome = await getTranslations('home');
  const tWorkflow = await getTranslations('workflow');

  return (
    <section
      className="mb-12 scroll-mt-20 py-10 sm:mb-16 sm:py-14 lg:mb-20 lg:py-16"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto w-full min-w-0">
        <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10 lg:mb-12 lg:max-w-3xl">
          <h2
            id="how-it-works-heading"
            className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-[2.5rem] lg:leading-tight"
          >
            {tHome('landing.howItWorks.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:mt-5 sm:text-base">
            {tHome('landing.howItWorks.subtitle')}
          </p>
        </header>

        <ol className="grid list-none grid-cols-1 gap-10 md:grid-cols-3 md:gap-x-6 md:gap-y-0 lg:gap-x-10">
          {STEP_KEYS.map((key, index) => {
            const { src, width, height } = STEP_IMAGES[index];
            const title = tWorkflow(`steps.${key}.name`);
            const description = tWorkflow(`steps.${key}.description`);

            return (
              <li
                key={key}
                className="group flex flex-col items-center text-center [&::marker]:hidden"
              >
                <div className="mb-2 w-full overflow-hidden">
                  <div className="relative flex aspect-1295/816 w-full items-end justify-center px-4 pt-4 pb-0 sm:px-5 sm:pt-5 lg:px-6 lg:pt-6">
                    <Image
                      src={src}
                      alt=""
                      role="presentation"
                      width={width}
                      height={height}
                      unoptimized
                      className="h-full w-full object-contain object-bottom transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-[1.02]"
                      sizes="(min-width: 1024px) 28vw, (min-width: 768px) 30vw, 100vw"
                    />
                  </div>
                </div>

                <span
                  className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  aria-hidden
                >
                  {index + 1}
                </span>

                <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted sm:text-base">
                  {description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
