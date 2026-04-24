import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function VideoEditPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}/video-edit/work-space`);
}
