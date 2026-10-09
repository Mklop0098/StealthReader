import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import type { ReaderAnchor } from '@stealth-reader/shared-types';

const PARAGRAPH_SELECTOR = '[data-paragraph-id]';

interface AnchorTrackerOptions {
  rootRef: RefObject<HTMLElement | null>;
  bookId: string;
  chapterId: string;
  onAnchorChange: (anchor: ReaderAnchor) => void;
  enabled?: boolean;
}

/**
 * Tracks the topmost visible paragraph and reports it as the canonical anchor.
 * Uses IntersectionObserver so the cost stays constant for very large chapters
 * (avoiding an O(n) scan per scroll frame).
 */
export function useAnchorTracker({
  rootRef,
  bookId,
  chapterId,
  onAnchorChange,
  enabled = true,
}: AnchorTrackerOptions): void {
  const handlerRef = useRef(onAnchorChange);
  handlerRef.current = onAnchorChange;

  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || typeof IntersectionObserver === 'undefined') return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>(PARAGRAPH_SELECTOR));
    if (elements.length === 0) return;

    const visible = new Map<string, HTMLElement>();

    const report = (): void => {
      let best: HTMLElement | null = null;
      for (const element of visible.values()) {
        if (!best || element.offsetTop < best.offsetTop) best = element;
      }
      const paragraphId = best?.dataset.paragraphId;
      if (!paragraphId) return;
      const span = Math.max(1, root.scrollHeight - root.clientHeight);
      const viewportFraction = Math.min(1, Math.max(0, root.scrollTop / span));
      handlerRef.current({ bookId, chapterId, paragraphId, charOffset: 0, viewportFraction });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const id = element.dataset.paragraphId;
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, element);
          else visible.delete(id);
        }
        report();
      },
      { root, threshold: [0, 0.25, 0.5, 1] },
    );

    elements.forEach((element) => observer.observe(element));
    report();
    return () => observer.disconnect();
  }, [rootRef, bookId, chapterId, enabled]);
}

interface AnchorRestoreOptions {
  rootRef: RefObject<HTMLElement | null>;
  anchor: ReaderAnchor | null;
  chapterId: string;
}

/**
 * Scrolls the anchored paragraph into view when a chapter opens. Runs only on
 * chapter change so ordinary scrolling never fights the user.
 */
export function useAnchorRestore({ rootRef, anchor, chapterId }: AnchorRestoreOptions): void {
  const lastChapter = useRef<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !anchor) return;
    if (lastChapter.current === chapterId) return;
    lastChapter.current = chapterId;

    if (!anchor.paragraphId) {
      root.scrollTop = 0;
      return;
    }
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(anchor.paragraphId)
        : anchor.paragraphId;
    const target = root.querySelector<HTMLElement>(`[data-paragraph-id="${escaped}"]`);
    if (target) {
      root.scrollTop = Math.max(0, target.offsetTop - root.clientHeight * 0.25);
    } else {
      const span = Math.max(0, root.scrollHeight - root.clientHeight);
      root.scrollTop = span * anchor.viewportFraction;
    }
  }, [rootRef, anchor, chapterId]);
}

/** Maps the app font settings onto CSS custom properties. */
export function fontStyle(settings: {
  font: { family: string; size: number; lineHeight: number; width: number };
}): CSSProperties {
  const families: Record<string, string> = {
    'reader-skin': 'var(--skin-font)',
    'reader-serif': '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    'reader-sans': '"Segoe UI", system-ui, -apple-system, sans-serif',
    'reader-mono': 'Consolas, "Cascadia Mono", "Courier New", monospace',
  };
  return {
    '--reader-family': families[settings.font.family] ?? families['reader-serif'],
    '--reader-size': `${settings.font.size}px`,
    '--reader-line-height': String(settings.font.lineHeight),
    '--reader-width': `${settings.font.width}px`,
  } as CSSProperties;
}
