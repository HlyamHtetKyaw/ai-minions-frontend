import { ProjectsDashboard } from '@/features/video-edit/components/projects-dashboard';

export default function VideoEditHistoryPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col py-6 sm:py-6">
      <div className="video-edit-shell min-w-0 w-full">
        <ProjectsDashboard />
      </div>
    </div>
  );
}
