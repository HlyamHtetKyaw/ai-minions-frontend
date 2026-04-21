import HeroOverview from '@/features/home/components/hero-overview';
import FeatureGrid from '@/features/home/components/feature-grid';

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
      <HeroOverview />
      <FeatureGrid />
    </div>
  );
}
