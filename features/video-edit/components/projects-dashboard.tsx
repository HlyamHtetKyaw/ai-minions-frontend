'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import {
  dashboardActionTileClassName,
  DashboardCardGrid,
  DashboardCardGridItem,
  DashboardFilterTabs,
  DashboardLoadMoreRow,
  DashboardMediaCardShell,
  DashboardSectionHeader,
  DashboardShellHeader,
  DashboardStatCard,
  DashboardStatGrid,
  type DashboardFilterOption,
} from '@/components/shared/dashboard';

type ProjectFilter = 'all' | 'drafts' | 'exported';
type ProjectStatus = 'exported' | 'processing' | 'draft';

type MockProject = {
  id: string;
  title: string;
  aspect: '9:16' | '1:1' | '16:9';
  duration: string;
  timeLabelKey: 'twoDays' | 'oneWeek' | 'threeDays';
  status: ProjectStatus;
};

const MOCK_PROJECTS: MockProject[] = [
  {
    id: '1',
    title: 'Summer reel 2024',
    aspect: '9:16',
    duration: '0:32',
    timeLabelKey: 'twoDays',
    status: 'exported',
  },
  {
    id: '2',
    title: 'Product launch teaser',
    aspect: '1:1',
    duration: '1:05',
    timeLabelKey: 'oneWeek',
    status: 'processing',
  },
  {
    id: '3',
    title: 'Tutorial — intro',
    aspect: '16:9',
    duration: '3:12',
    timeLabelKey: 'threeDays',
    status: 'draft',
  },
  {
    id: '4',
    title: 'Client pitch v2',
    aspect: '16:9',
    duration: '0:48',
    timeLabelKey: 'twoDays',
    status: 'exported',
  },
  {
    id: '5',
    title: 'Stories batch A',
    aspect: '9:16',
    duration: '0:15',
    timeLabelKey: 'oneWeek',
    status: 'draft',
  },
];

const STATS = {
  totalProjects: 12,
  exportedVideos: 8,
  storageUsed: '2.4 GB',
} as const;

function matchesFilter(p: MockProject, filter: ProjectFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'drafts') return p.status === 'draft';
  return p.status === 'exported';
}

export function ProjectsDashboard() {
  const locale = useLocale();
  const t = useTranslations('video-edit.projects');
  const [filter, setFilter] = useState<ProjectFilter>('all');

  const workspace = (projectId?: string) =>
    projectId
      ? `/${locale}/video-edit/work-space?project=${encodeURIComponent(projectId)}`
      : `/${locale}/video-edit/upload`;

  const filterOptions = useMemo(
    (): DashboardFilterOption<ProjectFilter>[] => [
      { id: 'all', label: t('filters.all') },
      { id: 'drafts', label: t('filters.drafts') },
      { id: 'exported', label: t('filters.exported') },
    ],
    [t],
  );

  const visible = useMemo(
    () => MOCK_PROJECTS.filter((p) => matchesFilter(p, filter)),
    [filter],
  );

  return (
    <div className="video-edit-projects space-y-8">
      <DashboardShellHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <NextLink
            href={workspace()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-foreground/25 bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            {t('newProject')}
          </NextLink>
        }
      />

      <DashboardStatGrid>
        <DashboardStatCard label={t('stats.totalProjects')} value={STATS.totalProjects} />
        <DashboardStatCard label={t('stats.exportedVideos')} value={STATS.exportedVideos} />
        <DashboardStatCard label={t('stats.storageUsed')} value={STATS.storageUsed} />
      </DashboardStatGrid>

      <DashboardSectionHeader
        title={t('recent')}
        trailing={
          <DashboardFilterTabs
            options={filterOptions}
            value={filter}
            onChange={setFilter}
            ariaLabel={t('filtersAria')}
          />
        }
      />

      <DashboardCardGrid>
        {visible.map((project) => (
          <DashboardCardGridItem key={project.id}>
            <DashboardMediaCardShell>
              <NextLink
                href={workspace(project.id)}
                className="relative block aspect-video overflow-hidden bg-linear-to-br from-zinc-800 via-zinc-900 to-black"
              >
                <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {project.aspect}
                </span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-sm transition-transform group-hover:scale-105">
                    <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-2 py-0.5 font-mono text-[11px] text-white">
                  {project.duration}
                </span>
              </NextLink>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">
                  {project.title}
                </h3>
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">{t(`timeAgo.${project.timeLabelKey}`)}</span>
                  <StatusPill status={project.status} label={t(`status.${project.status}`)} />
                  <div className="ml-auto flex items-center gap-1">
                    <NextLink
                      href={workspace(project.id)}
                      className="rounded-md border border-white/10 p-1.5 text-muted transition-colors hover:border-white/25 hover:text-foreground"
                      aria-label={t('editProject')}
                    >
                      <Pencil className="h-4 w-4" />
                    </NextLink>
                    <button
                      type="button"
                      className="rounded-md border border-white/10 p-1.5 text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                      aria-label={t('deleteProject')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </DashboardMediaCardShell>
          </DashboardCardGridItem>
        ))}

        <DashboardCardGridItem>
          <NextLink href={workspace()} className={dashboardActionTileClassName}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/20 text-foreground">
              <Plus className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium text-foreground">{t('newProject')}</span>
          </NextLink>
        </DashboardCardGridItem>
      </DashboardCardGrid>

      <DashboardLoadMoreRow>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-muted transition-colors hover:border-white/30 hover:text-foreground"
          aria-label={t('loadMore')}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </DashboardLoadMoreRow>
    </div>
  );
}

function StatusPill({ status, label }: { status: ProjectStatus; label: string }) {
  const styles: Record<ProjectStatus, string> = {
    exported:
      'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 [&>span]:bg-emerald-400',
    processing:
      'bg-amber-500/12 text-amber-200 ring-1 ring-amber-500/25 [&>span]:bg-amber-400',
    draft: 'bg-white/5 text-muted ring-1 ring-white/10 [&>span]:bg-zinc-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
      {label}
    </span>
  );
}
