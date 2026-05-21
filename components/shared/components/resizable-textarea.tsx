'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { GripHorizontal } from 'lucide-react';

type ResizableTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minHeightPx?: number;
  maxHeightPx?: number;
  /** Visible hint on the drag bar (recommended for discoverability). */
  resizeLabel?: string;
  /** Border/radius on the outer shell; inner field should omit border/rounded. */
  wrapperClassName?: string;
};

function stripNativeResizeClasses(className: string): string {
  return className
    .replace(/\bresize-(none|both|x|y|horizontal|vertical)\b/g, '')
    .replace(/\bmin-h-\[[^\]]+\]/g, '')
    .replace(/\bmin-h-\S+/g, '')
    .replace(/\brounded(-\S+)?\b/g, '')
    .replace(/\bborder(-\S+)?\b/g, '')
    .replace(/\bpb-\S+/g, '')
    .trim();
}

/**
 * Textarea with a labeled bottom drag bar for vertical resize (mobile + desktop).
 */
export function ResizableTextarea({
  minHeightPx = 140,
  maxHeightPx = 520,
  resizeLabel = 'Drag to resize',
  wrapperClassName = 'overflow-hidden rounded border border-violet-200/50 dark:border-violet-500/15',
  className = '',
  style,
  onChange,
  ...rest
}: ResizableTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [heightPx, setHeightPx] = useState(minHeightPx);
  const handleLabelId = useId();

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const measured = Math.max(minHeightPx, el.getBoundingClientRect().height);
    if (measured > 0) setHeightPx(measured);
  }, [minHeightPx]);

  const onResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: heightPx };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [heightPx],
  );

  const onResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      const delta = e.clientY - dragRef.current.startY;
      setHeightPx(
        Math.min(maxHeightPx, Math.max(minHeightPx, dragRef.current.startH + delta)),
      );
    },
    [minHeightPx, maxHeightPx],
  );

  const endResizeDrag = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const textareaClass = `${stripNativeResizeClasses(className)} box-border w-full resize-none overflow-y-auto border-0 bg-transparent outline-none focus:ring-0`.trim();

  return (
    <div className={wrapperClassName}>
      <textarea
        ref={textareaRef}
        {...rest}
        onChange={onChange}
        className={textareaClass}
        style={{ ...style, height: `${heightPx}px` }}
      />
      <button
        type="button"
        aria-labelledby={handleLabelId}
        title={resizeLabel}
        className="flex min-h-10 w-full cursor-row-resize touch-none items-center justify-center gap-2 border-t border-violet-200/60 bg-violet-100/90 px-3 py-2 text-violet-800 transition-colors hover:bg-violet-200/90 active:bg-violet-200 dark:border-violet-400/25 dark:bg-violet-500/20 dark:text-violet-100 dark:hover:bg-violet-500/30 dark:active:bg-violet-500/35"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResizeDrag}
        onPointerCancel={endResizeDrag}
      >
        <GripHorizontal className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
        <span id={handleLabelId} className="text-[10px] font-semibold tracking-wide uppercase">
          {resizeLabel}
        </span>
        <GripHorizontal className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
