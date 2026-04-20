import { ProjectsDashboard } from '@/features/video-edit/components/projects-dashboard';

export default function VideoEditPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="video-edit-shell">
          <ProjectsDashboard />
        </div>
      </div>
    </div>
  );
}
