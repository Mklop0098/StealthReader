/**
 * Maps Tauri accelerator strings onto DOM keyboard events so the in-app
 * fallback works even when the OS refuses a global shortcut (acceptance test
 * AT-12). Only the modifiers used by this app are supported.
 */
export function matchesAccelerator(event: KeyboardEvent, accelerator: string): boolean {
  const parts = accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return false;

  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));

  const wantCtrl =
    modifiers.has('commandorcontrol') || modifiers.has('control') || modifiers.has('ctrl');
  const wantMeta =
    modifiers.has('command') || modifiers.has('cmd') || modifiers.has('super');
  const wantAlt = modifiers.has('alt') || modifiers.has('option');
  const wantShift = modifiers.has('shift');

  if (event.ctrlKey !== wantCtrl) return false;
  if (event.metaKey !== wantMeta) return false;
  if (event.altKey !== wantAlt) return false;
  if (event.shiftKey !== wantShift) return false;

  return event.key.toLowerCase() === key;
}

/** Returns true when two accelerators would collide. */
export function acceleratorsConflict(a: string, b: string): boolean {
  return normalise(a) === normalise(b);
}

function normalise(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .sort()
    .join('+');
}
