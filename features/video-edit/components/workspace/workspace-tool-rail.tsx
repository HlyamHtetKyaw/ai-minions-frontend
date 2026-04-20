import { type ReactNode } from 'react';
import {
  Captions,
  Clapperboard,
  Crop,
  Droplets,
  Gauge,
  Image,
  Music,
  Scissors,
  Type,
} from 'lucide-react';
import { WorkspaceIconToolButton } from './ui';

export type WorkspaceToolId =
  | 'media'
  | 'text'
  | 'blur'
  | 'image'
  | 'crop'
  | 'speed'
  | 'subs'
  | 'audio'
  | 'trim';

type ToolDef = { id: WorkspaceToolId; label: string };

type WorkspaceToolRailProps = {
  tools: ToolDef[];
  activeTool: WorkspaceToolId;
  onToolChange: (id: WorkspaceToolId) => void;
};

const ICONS: Record<WorkspaceToolId, ReactNode> = {
  media: <Clapperboard strokeWidth={1.75} />,
  text: <Type strokeWidth={1.75} />,
  blur: <Droplets strokeWidth={1.75} />,
  image: <Image strokeWidth={1.75} />,
  crop: <Crop strokeWidth={1.75} />,
  speed: <Gauge strokeWidth={1.75} />,
  subs: <Captions strokeWidth={1.75} />,
  audio: <Music strokeWidth={1.75} />,
  trim: <Scissors strokeWidth={1.75} />,
};

export function WorkspaceToolRail({ tools, activeTool, onToolChange }: WorkspaceToolRailProps) {
  return (
    <aside
      className="flex w-full shrink-0 flex-row gap-1.5 overflow-x-auto overflow-y-hidden border-b border-white/10 bg-black/60 px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] lg:h-full lg:max-h-none lg:w-[4.5rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-r lg:border-b-0 lg:px-2 lg:py-3 [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
      aria-label="Editing tools"
    >
      {tools.map((tool) => (
        <WorkspaceIconToolButton
          key={tool.id}
          label={tool.label}
          icon={ICONS[tool.id]}
          active={activeTool === tool.id}
          onClick={() => onToolChange(tool.id)}
        />
      ))}
    </aside>
  );
}
