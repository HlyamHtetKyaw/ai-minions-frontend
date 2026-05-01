'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type WorkspaceRankingItem = {
  key: string;
  kicker: string;
  headline: string;
  description: string;
};

type Props = {
  items: WorkspaceRankingItem[];
};

const SLOT_HEIGHT = 114;
const SLOT_GAP = 12;
const SLOT_COUNT = 3;
const TOP_INSET = 10;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function WorkspaceLiveRanking({ items }: Props) {
  const previousRankRef = useRef<Record<string, number>>({});
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    items.forEach((item, idx) => {
      init[item.key] = 100 - idx * 5;
    });
    return init;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setScores((prev) => {
        const next = { ...prev };
        // Keep ordering alive but smooth by drifting toward center before random nudges.
        items.forEach((item) => {
          const current = next[item.key] ?? 100;
          next[item.key] = current * 0.9 + 10;
        });
        const nudges = randomInt(1, Math.min(3, items.length));
        for (let i = 0; i < nudges; i++) {
          const item = items[randomInt(0, items.length - 1)];
          const delta = randomInt(-10, 14);
          next[item.key] = Math.max(20, Math.min(220, (next[item.key] ?? 100) + delta));
        }
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, [items]);

  const rankedAll = useMemo(() => {
    return [...items].sort((a, b) => (scores[b.key] ?? 0) - (scores[a.key] ?? 0));
  }, [items, scores]);
  const ranked = rankedAll.slice(0, SLOT_COUNT);

  const movementByKey = useMemo(() => {
    const prev = previousRankRef.current;
    const movement: Record<string, number> = {};
    rankedAll.forEach((item, index) => {
      const previousIndex = prev[item.key];
      movement[item.key] = typeof previousIndex === 'number' ? previousIndex - index : 0;
    });
    return movement;
  }, [rankedAll]);

  useEffect(() => {
    const next: Record<string, number> = {};
    rankedAll.forEach((item, index) => {
      next[item.key] = index;
    });
    previousRankRef.current = next;
  }, [rankedAll]);

  const containerHeight = TOP_INSET + SLOT_COUNT * SLOT_HEIGHT + (SLOT_COUNT - 1) * SLOT_GAP;

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{ height: containerHeight, perspective: '1200px', transformStyle: 'preserve-3d' }}
    >
      {ranked.map((item, idx) => (
        <div
          key={item.key}
          className="absolute left-0 right-0 rounded-2xl border border-card-border bg-linear-to-br from-white/10 via-white/4 to-transparent px-4 py-3.5 backdrop-blur-sm transition-[top,transform,opacity,box-shadow,filter] duration-900 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            top: TOP_INSET + idx * (SLOT_HEIGHT + SLOT_GAP),
            transform: `translateY(0) translateZ(${16 - idx * 6}px) scale(${1 - idx * 0.02})`,
            opacity: 1 - idx * 0.12,
            boxShadow: 'none',
            filter: idx === 0 ? 'saturate(1.08)' : 'saturate(0.95)',
            transformOrigin: '50% 50%',
          }}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.kicker}</p>
            <span className="rounded-full border border-card-border bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-muted">
              #{idx + 1}
              {movementByKey[item.key] > 0 ? ' ↑' : movementByKey[item.key] < 0 ? ' ↓' : ' •'}
            </span>
          </div>
          <p className="mt-0.5 font-semibold text-foreground">{item.headline}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{item.description}</p>
        </div>
      ))}
    </div>
  );
}

