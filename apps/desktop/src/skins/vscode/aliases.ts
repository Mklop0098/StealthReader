const MODULE_NAMES = ['schema', 'aggregate', 'collector', 'adapter', 'store', 'service', 'types', 'config', 'worker', 'pipeline'];

/** Stable aliases depend only on ordinal, never book/chapter titles or content. */
export function moduleFileName(ordinal: number): string {
  const index = Math.max(0, ordinal);
  const base = MODULE_NAMES[index % MODULE_NAMES.length]!;
  const group = Math.floor(index / MODULE_NAMES.length);
  return `${base}${group > 0 ? `-${String(group + 1).padStart(2, '0')}` : ''}.ts`;
}
