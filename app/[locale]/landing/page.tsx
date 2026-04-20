import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

/** Legacy URL; locale root is the marketing landing. */
export default async function LegacyLandingPath({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
