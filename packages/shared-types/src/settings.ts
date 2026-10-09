import type { SkinId } from './skin.js';

export type ReaderAction =
  | 'quickSwitch'
  | 'restoreReading'
  | 'nextChapter'
  | 'prevChapter'
  | 'toggleBookmark'
  | 'openLibrary'
  | 'openSettings'
  | 'openSearch';

/** A single user-configurable accelerator in Tauri's accelerator syntax. */
export interface HotkeyBinding {
  action: ReaderAction;
  accelerator: string;
}

export interface FontSettings {
  /** CSS font-family stack name; resolved to a concrete stack by the skin. */
  family: string;
  /** Font size in CSS pixels, clamped to [12, 40]. */
  size: number;
  /** Unitless line-height multiplier, clamped to [1.0, 3.0]. */
  lineHeight: number;
  /** Reading column width in CSS pixels, clamped to [480, 1600]. */
  width: number;
}

export interface PrivacySettings {
  /** When true the library hides the "recently opened" shelf. */
  hideRecentBooks: boolean;
  /** When true neutral view is used as the landing screen on launch. */
  launchInNeutral: boolean;
}

export interface AppSettings {
  activeSkin: SkinId;
  font: FontSettings;
  hotkeys: HotkeyBinding[];
  privacy: PrivacySettings;
  /** Legacy terminal animation preference, retained for settings compatibility. */
  typewriterEnabled: boolean;
  /** Brief typing transition on chapter entry, across all reading skins. */
  chapterTypingEnabled: boolean;
  /** Editor-style line numbers (VS Code skin). */
  lineNumbers: boolean;
  /** Respects prefers-reduced-motion when true. */
  reducedMotion: boolean;
}

export interface ShortcutRegistrationResult {
  registered: boolean;
  accelerator: string;
  /** Present when registration failed; safe to show (contains no book data). */
  reason: string | null;
}

export const DEFAULT_HOTKEYS: readonly HotkeyBinding[] = [
  { action: 'quickSwitch', accelerator: 'CommandOrControl+Alt+Shift+Q' },
  { action: 'restoreReading', accelerator: 'CommandOrControl+Alt+Shift+W' },
  { action: 'nextChapter', accelerator: 'Alt+ArrowRight' },
  { action: 'prevChapter', accelerator: 'Alt+ArrowLeft' },
  { action: 'toggleBookmark', accelerator: 'CommandOrControl+Alt+Shift+B' },
  { action: 'openSearch', accelerator: 'CommandOrControl+Shift+F' },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  activeSkin: 'vscode',
  font: {
    family: 'reader-skin',
    size: 18,
    lineHeight: 1.6,
    width: 760,
  },
  hotkeys: [...DEFAULT_HOTKEYS],
  privacy: {
    hideRecentBooks: false,
    launchInNeutral: false,
  },
  typewriterEnabled: false,
  chapterTypingEnabled: true,
  lineNumbers: true,
  reducedMotion: false,
};
