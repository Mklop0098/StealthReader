/**
 * DTOs owned by the Tauri shell (not part of the shared core contract) plus
 * their boundary validators. Kept dependency-free so tests can import them
 * without touching Tauri APIs.
 */

export interface ProgressAck {
  revision: number;
  applied: boolean;
}

export interface ShortcutRegistration {
  registered: boolean;
  accelerator: string;
  reason: string | null;
}

export interface ShortcutsRegistration {
  quickSwitch: ShortcutRegistration;
  restoreReading: ShortcutRegistration;
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Malformed IPC payload at ${path}: expected object`);
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Malformed IPC payload at ${path}: expected number`);
  }
  return value;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`Malformed IPC payload at ${path}: expected boolean`);
  }
  return value;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Malformed IPC payload at ${path}: expected string`);
  }
  return value;
}

function asNullableString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  return asString(value, path);
}

export function parseProgressAck(value: unknown): ProgressAck {
  const record = asRecord(value, 'progressAck');
  return {
    revision: asNumber(record.revision, 'progressAck.revision'),
    applied: asBoolean(record.applied, 'progressAck.applied'),
  };
}

export function parseShortcutRegistration(value: unknown, path: string): ShortcutRegistration {
  const record = asRecord(value, path);
  return {
    registered: asBoolean(record.registered, `${path}.registered`),
    accelerator: asString(record.accelerator, `${path}.accelerator`),
    reason: asNullableString(record.reason, `${path}.reason`),
  };
}

export function parseShortcutsRegistration(value: unknown): ShortcutsRegistration {
  const record = asRecord(value, 'shortcuts');
  return {
    quickSwitch: parseShortcutRegistration(record.quickSwitch, 'shortcuts.quickSwitch'),
    restoreReading: parseShortcutRegistration(record.restoreReading, 'shortcuts.restoreReading'),
  };
}
