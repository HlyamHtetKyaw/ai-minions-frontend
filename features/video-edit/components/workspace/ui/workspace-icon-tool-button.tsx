import { type ReactNode } from 'react';

type WorkspaceIconToolButtonProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function WorkspaceIconToolButton({
  icon,
  label,
  active = false,
  onClick,
  disabled = false,
}: WorkspaceIconToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-[10px] font-medium transition-colors ${
        disabled
          ? 'pointer-events-none border-white/10 bg-black/20 text-zinc-500 opacity-45'
          : active
          ? 'border-violet-400/50 bg-violet-500/10 text-foreground'
          : 'border-white/10 bg-black/30 text-muted hover:border-white/20 hover:text-foreground'
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center text-current [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="leading-none">{label}</span>
    </button>
  );
}
