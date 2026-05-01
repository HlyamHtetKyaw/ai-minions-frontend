import type { ReactNode } from 'react';

/**
 * Escape the locale layout content shell (max-w-7xl + horizontal padding) so the
 * editor can use the full viewport width.
 */
export default function VideoWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative ml-[calc(50%-50vw)] w-screen max-w-[100vw] min-w-0">
      {children}
    </div>
  );
}
