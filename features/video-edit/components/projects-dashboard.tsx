'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Pencil, Play, Plus, Trash2 } from 'lucide-react';

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
      : `/${locale}/video-edit/work-space`;

  const visible = useMemo(
    () => MOCK_PROJECTS.filter((p) => matchesFilter(p, filter)),
    [filter],
  );

  return (
    <div className="video-edit-projects space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <NextLink
          href={workspace()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-foreground/25 bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          {t('newProject')}
        </NextLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="video-edit-projects-stat rounded-2xl border border-white/10 bg-black/20 p-5 dark:bg-white/4">
          <p className="text-xs font-medium text-muted">{t('stats.totalProjects')}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {STATS.totalProjects}
          </p>
        </div>
        <div className="video-edit-projects-stat rounded-2xl border border-white/10 bg-black/20 p-5 dark:bg-white/4">
          <p className="text-xs font-medium text-muted">{t('stats.exportedVideos')}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {STATS.exportedVideos}
          </p>
        </div>
        <div className="video-edit-projects-stat rounded-2xl border border-white/10 bg-black/20 p-5 dark:bg-white/4">
          <p className="text-xs font-medium text-muted">{t('stats.storageUsed')}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
            {STATS.storageUsed}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('recent')}</h2>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={t('filtersAria')}
        >
          {(['all', 'drafts', 'exported'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === key
                  ? 'border border-foreground/40 bg-foreground/5 text-foreground'
                  : 'border border-transparent text-muted hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              {t(`filters.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((project) => (
          <li key={project.id}>
            <article className="video-edit-project-card group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/15 shadow-sm dark:bg-white/3">
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
            </article>
          </li>
        ))}

        <li>
          <NextLink
            href={workspace()}
            className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-black/10 px-6 py-10 text-center transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/6 dark:bg-white/2"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-black/20 text-foreground">
              <Plus className="h-7 w-7" strokeWidth={2} />
            </span>
            <span className="text-sm font-medium text-foreground">{t('newProject')}</span>
          </NextLink>
        </li>
      </ul>

      <div className="flex justify-center pb-4 pt-2">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-muted transition-colors hover:border-white/30 hover:text-foreground"
          aria-label={t('loadMore')}
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
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
