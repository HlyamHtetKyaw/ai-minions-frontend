import { getTranslations } from 'next-intl/server';
import HeaderShell from '@/components/layout/header-shell';

export default async function Header() {
  const tHeader = await getTranslations('header');

  return (
    <header className="sticky top-0 z-[100] min-w-0 px-4 pt-4 sm:px-6">
      <HeaderShell
        dashboardLabel={tHeader('dashboardLabel')}
        brandTitle={tHeader('brandTitle')}
        languageLabel={tHeader('languageLabel')}
        toolsLabel={tHeader('aiModels')}
        homeLabel={tHeader('home')}
        workspaceLabel={tHeader('tools')}
        pricingLabel={tHeader('pricing')}
      />
    </header>
  );
}
