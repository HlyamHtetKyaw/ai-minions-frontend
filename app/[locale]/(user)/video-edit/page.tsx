import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function VideoEditPage({ params }: Props) {
  const { locale } = await params;
  /** Open the shell first: it fetches `/api/v1/video-editor/workspace` and only routes to upload when there is no saved project. */
  redirect(`/${locale}/video-edit/work-space`);
}
