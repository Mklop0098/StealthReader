import type { ComponentType } from 'react';
import type {
  AppSettings,
  ChapterDto,
  ChapterSummary,
  ReaderAnchor,
  SkinId,
} from '@stealth-reader/shared-types';

/** Minimal book identity a skin may display in its own chrome. */
export interface ReaderBookContext {
  id: string;
  title: string;
}

/**
 * Props every skin's reading surface receives. Skins are pure presentational
 * consumers: they render `chapter` and report position changes through
 * `onAnchorChange`. They must never talk to the database or the network.
 *
 * The contract is additive over the PRD sketch (`chapter`/`anchor`/
 * `onAnchorChange`) so each skin can build its own chrome — see
 * `docs/adr/0006-skin-contract-extension.md`.
 */
export interface ReaderViewProps {
  chapter: ChapterDto;
  anchor: ReaderAnchor;
  onAnchorChange: (anchor: ReaderAnchor) => void;
  book: ReaderBookContext;
  chapters: ChapterSummary[];
  onSelectChapter: (chapterId: string) => void;
  onStepChapter: (direction: 1 | -1) => void;
  settings: AppSettings;
}

/** Props for a skin's neutral (non-book) workspace. Intentionally data-free. */
export interface NeutralViewProps {
  /** Milliseconds since the neutral view mounted; used for static animation only. */
  elapsedMs?: number;
}

export interface ReaderSkin {
  id: SkinId;
  displayName: string;
  description: string;
  /** Reading surface. Receives sanitized text DTOs only. */
  ReaderView: ComponentType<ReaderViewProps>;
  /** Preloadable neutral workspace. Must contain zero book-derived data. */
  NeutralView: ComponentType<NeutralViewProps>;
}
