import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

/* ─── Sub-components ─────────────────────────────────────────── */

interface IconProps {
  /** CSS class for the coloured tile wrapper, e.g. "transcribe-icon-tile" */
  tileClassName?: string;
  children: ReactNode;
}

function Icon({ tileClassName, children }: IconProps) {
  return (
    <div className={tileClassName} aria-hidden>
      {children}
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
      {children}
    </h1>
  );
}

type IconButtonProps = ComponentPropsWithoutRef<'button'>;

function IconButton({ children, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Subtitle({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted">{children}</p>;
}

/* ─── Root ───────────────────────────────────────────────────── */

interface PageHeaderProps {
  /** Icon tile — use <PageHeader.Icon> */
  icon: ReactNode;
  /** Main heading — use <PageHeader.Title> */
  title: ReactNode;
  /** Optional button rendered beside the title — use <PageHeader.IconButton> */
  action?: ReactNode;
  /** Optional descriptor line — use <PageHeader.Subtitle> */
  subtitle?: ReactNode;
}

const PageHeader = ({ icon, title, action, subtitle }: PageHeaderProps) => (
  <header className="flex gap-4">
    {icon}
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        {title}
        {action}
      </div>
      {subtitle}
    </div>
  </header>
);

PageHeader.Icon = Icon;
PageHeader.Title = Title;
PageHeader.IconButton = IconButton;
PageHeader.Subtitle = Subtitle;

export default PageHeader;
