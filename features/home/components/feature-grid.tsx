import { getTranslations } from 'next-intl/server';
import { FEATURES } from '@/features';
import FeatureCard from './feature-card';

const CARD_ACCENTS = [
  'bg-blue-500 shadow-blue-500/30',
  'bg-emerald-500 shadow-emerald-500/30',
  'bg-rose-500 shadow-rose-500/30',
  'bg-amber-500 shadow-amber-500/30',
  'bg-violet-500 shadow-violet-500/30',
  'bg-cyan-500 shadow-cyan-500/30',
  'bg-fuchsia-500 shadow-fuchsia-500/30',
];

export default async function FeatureGrid() {
  const tHome = await getTranslations('home');
  const tFeatures = await getTranslations('features');

  return (
    <section id="tools" aria-labelledby="tools-heading">
      <h2 id="tools-heading" className="mb-6 text-lg font-semibold text-foreground sm:text-xl">
        {tHome('allTools')}
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <FeatureCard
            key={feature.key}
            href={feature.href}
            icon={feature.icon}
            accent={CARD_ACCENTS[index % CARD_ACCENTS.length]}
            category={tFeatures(`${feature.key}.category`)}
            name={tFeatures(`${feature.key}.name`)}
            description={tFeatures(`${feature.key}.description`)}
            availableLabel={tHome('available')}
            openCardLabel={tHome('openCardLink')}
          />
        ))}
      </div>
    </section>
  );
}
