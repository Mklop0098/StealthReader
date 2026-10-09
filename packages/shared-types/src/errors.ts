export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_FORMAT'
  | 'IMPORT_FAILED'
  | 'NOT_FOUND'
  | 'DB_ERROR'
  | 'SHORTCUT_UNAVAILABLE';

export interface AppError {
  code: ErrorCode;
  message: string;
  recoverable: boolean;
}

const ERROR_CODES: readonly ErrorCode[] = [
  'INVALID_INPUT',
  'UNSUPPORTED_FORMAT',
  'IMPORT_FAILED',
  'NOT_FOUND',
  'DB_ERROR',
  'SHORTCUT_UNAVAILABLE',
] as const;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Envelope returned by every Rust command that can fail. Commands never throw
 * raw strings across the IPC boundary; they resolve to this shape so the
 * frontend can branch on a closed set of codes.
 */
export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

export function isAppError(value: unknown): value is AppError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isErrorCode(candidate.code) &&
    typeof candidate.message === 'string' &&
    typeof candidate.recoverable === 'boolean'
  );
}
