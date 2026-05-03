import type { ReactNode } from 'react';

/** Full-bleed shell (same breakout as work-space). */
export default function VideoEditUploadLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative ml-[calc(50%-50vw)] w-screen max-w-[100vw] min-w-0">
      {children}
    </div>
  );
}
