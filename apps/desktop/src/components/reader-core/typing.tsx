import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChapterDto, ReaderAnchor } from '@stealth-reader/shared-types';

const MAX_OPENING_CHARS = 1200;
const MAX_DURATION_MS = 3500;

export function useChapterTyping({ chapter, anchor, enabled, reducedMotion, holdMs = 0 }: {
  chapter: ChapterDto;
  anchor: ReaderAnchor;
  enabled: boolean;
  reducedMotion: boolean;
  /** Optional pause (e.g. a "thinking" indicator) before the text starts revealing. */
  holdMs?: number;
}) {
  const entryAnchor = useRef(anchor);
  entryAnchor.current = anchor;
  const [systemReducedMotion, setSystemReducedMotion] = useState(() =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Capture the entry position once per chapter, independent of progress writes.
  const plan = useMemo(() => {
    const first = Math.max(0, chapter.paragraphs.findIndex(p => p.id === entryAnchor.current.paragraphId));
    const offsets = new Map<number, number>();
    let total = 0;
    for (let index = first; index < chapter.paragraphs.length && total < MAX_OPENING_CHARS; index++) {
      offsets.set(index, total);
      total += Math.min(chapter.paragraphs[index]!.content.length, MAX_OPENING_CHARS - total);
    }
    return { key: chapter.id, first, offsets, total };
  }, [chapter.id, chapter.paragraphs]);
  const [progress, setProgress] = useState({ plan, count: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holdingPlan, setHoldingPlan] = useState<typeof plan | null>(null);
  const shouldType = enabled && !reducedMotion && !systemReducedMotion;
  const count = progress.plan === plan ? progress.count : 0;
  const isTyping = shouldType && count < plan.total;
  const isThinking = isTyping && holdingPlan === plan;
  const finish = useCallback(() => {
    if (timerRef.current !== null) clearInterval(timerRef.current);
    timerRef.current = null;
    if (holdRef.current !== null) clearTimeout(holdRef.current);
    holdRef.current = null;
    setHoldingPlan(null);
    setProgress(current => current.plan === plan && current.count === plan.total ? current : { plan, count: plan.total });
  }, [plan]);
  useEffect(() => {
    if (!shouldType || plan.total === 0) return;
    setProgress({ plan, count: 0 });
    let timer: ReturnType<typeof setInterval> | null = null;
    let hold: ReturnType<typeof setTimeout> | null = null;
    const start = (): void => {
      hold = null;
      holdRef.current = null;
      setHoldingPlan(null);
      const started = performance.now();
      const duration = Math.min(MAX_DURATION_MS, Math.max(450, plan.total * 9));
      timer = setInterval(() => {
        const elapsed = performance.now() - started;
        const next = Math.min(plan.total, Math.floor(plan.total * elapsed / duration));
        setProgress(current => current.plan === plan && current.count === plan.total ? current : { plan, count: next });
        if (elapsed >= duration) {
          if (timer !== null) clearInterval(timer);
          timer = null;
          timerRef.current = null;
        }
      }, 32);
      timerRef.current = timer;
    };
    if (holdMs > 0) {
      setHoldingPlan(plan);
      hold = setTimeout(start, holdMs);
      holdRef.current = hold;
    } else {
      start();
    }
    return () => {
      if (timer !== null) clearInterval(timer);
      if (hold !== null) clearTimeout(hold);
      timerRef.current = null;
      holdRef.current = null;
    };
  }, [plan, shouldType, holdMs]);

  const visibleText = (index: number): string => {
    const text = chapter.paragraphs[index]?.content ?? '';
    if (!isTyping || index < plan.first) return text;
    const offset = plan.offsets.get(index);
    if (offset === undefined) return '';
    let end = Math.max(0, Math.min(text.length, count - offset));
    // Never reveal half of a UTF-16 surrogate pair (emoji, supplementary scripts).
    if (end > 0 && end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
    return text.slice(0, end);
  };
  let cursorIndex = plan.first;
  for (const [index, offset] of plan.offsets) {
    if (offset <= count) cursorIndex = index;
  }
  return { isTyping, isThinking, visibleText, cursorIndex, finish };
}

/** The hidden suffix preserves wrapping, scroll position and row measurements. */
export const TypingText = memo(function TypingText({ text, visible, cursor = false }: {
  text: string;
  visible: string;
  cursor?: boolean;
}) {
  return <><span className="typing-visible">{visible}</span>{cursor && <span className="typing-cursor" aria-hidden="true" />}<span className="typing-pending" aria-hidden="true">{text.slice(visible.length)}</span></>;
});
