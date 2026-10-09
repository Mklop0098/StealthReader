import { describe, expect, it } from 'vitest';
import { createSkinRegistry, SkinRegistry } from './registry.js';
import type { ReaderSkin } from './types.js';

function stubSkin(id: ReaderSkin['id']): ReaderSkin {
  const ReaderView = () => null;
  const NeutralView = () => null;
  return { id, displayName: id, description: '', ReaderView, NeutralView };
}

describe('SkinRegistry', () => {
  it('registers and retrieves skins', () => {
    const registry = createSkinRegistry([stubSkin('vscode'), stubSkin('excel')]);
    expect(registry.list()).toHaveLength(2);
    expect(registry.get('excel').id).toBe('excel');
    expect(registry.has('terminal')).toBe(false);
  });

  it('rejects duplicate registration', () => {
    const registry = createSkinRegistry([stubSkin('vscode')]);
    expect(() => registry.register(stubSkin('vscode'))).toThrow(/already registered/);
  });

  it('throws for an unknown skin', () => {
    const registry = new SkinRegistry();
    expect(() => registry.get('terminal')).toThrow(/not registered/);
  });
});
