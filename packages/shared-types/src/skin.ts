/**
 * Canvas-neutral primitives shared by the Rust backend contract and every skin.
 * These types are the canonical vocabulary of the ReaderController; no skin may
 * introduce its own notion of reading position.
 */

/** Stable identifier of a reading surface skin. */
export type SkinId = 'vscode' | 'excel' | 'terminal';

export const SKIN_IDS: readonly SkinId[] = ['vscode', 'excel', 'terminal'] as const;

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && (SKIN_IDS as readonly string[]).includes(value);
}

/** Supported book container formats. Mirrors the SQLite CHECK constraint. */
export type BookFormat = 'txt' | 'epub';

export function isBookFormat(value: unknown): value is BookFormat {
  return value === 'txt' || value === 'epub';
}
