import { redirect } from 'next/navigation';

export default function ViralShortsEditPage({
  params,
}: {
  params: { locale: string };
}) {
  redirect(`/${params.locale}/viral-shorts`);
}

