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
      className="mb-20 scroll-mt-24 px-6 py-16 sm:mb-24 sm:px-10 sm:py-20 lg:mb-28 lg:px-14 lg:py-24"
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-14 max-w-2xl text-center sm:mb-16 lg:mb-20 lg:max-w-3xl">
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

        <ol className="grid list-none grid-cols-1 gap-14 md:grid-cols-3 md:gap-x-8 md:gap-y-0 lg:gap-x-12">
          {STEP_KEYS.map((key, index) => {
            const { src, width, height } = STEP_IMAGES[index];
            const title = tWorkflow(`steps.${key}.name`);
            const description = tWorkflow(`steps.${key}.description`);

            return (
              <li
                key={key}
                className="group flex flex-col items-center text-center [&::marker]:hidden"
              >
                <div className="mb-8 w-full overflow-hidden">
                  <div className="relative flex aspect-5/4 w-full items-center justify-center p-4 sm:p-5 lg:p-6">
                    <Image
                      src={src}
                      alt=""
                      role="presentation"
                      width={width}
                      height={height}
                      unoptimized
                      className="h-full w-full object-contain object-center transition-transform duration-300 ease-out motion-reduce:transition-none group-hover:scale-[1.02]"
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
