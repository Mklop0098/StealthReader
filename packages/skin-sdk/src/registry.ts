import type { SkinId } from '@stealth-reader/shared-types';
import type { ReaderSkin } from './types.js';

/**
 * SkinRegistry owns the mapping from SkinId to a skin implementation. The
 * registry is intentionally inert: it does no DB access and no rendering, so it
 * can be unit tested and even preloaded before the app shell mounts.
 */
export class SkinRegistry {
  private readonly skins = new Map<SkinId, ReaderSkin>();

  register(skin: ReaderSkin): void {
    if (this.skins.has(skin.id)) {
      throw new Error(`Skin "${skin.id}" is already registered`);
    }
    this.skins.set(skin.id, skin);
  }

  has(id: SkinId): boolean {
    return this.skins.has(id);
  }

  get(id: SkinId): ReaderSkin {
    const skin = this.skins.get(id);
    if (!skin) throw new Error(`Skin "${id}" is not registered`);
    return skin;
  }

  list(): ReaderSkin[] {
    return [...this.skins.values()];
  }
}

export function createSkinRegistry(skins: ReaderSkin[] = []): SkinRegistry {
  const registry = new SkinRegistry();
  for (const skin of skins) registry.register(skin);
  return registry;
}
