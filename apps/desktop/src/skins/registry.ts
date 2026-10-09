import { createSkinRegistry, type ReaderSkin } from '@stealth-reader/skin-sdk';
import { vscodeSkin } from './vscode/index.js';
import { excelSkin } from './excel/index.js';
import { terminalSkin } from './terminal/index.js';

export const readerSkins: ReaderSkin[] = [vscodeSkin, excelSkin, terminalSkin];

/** Preloaded registry: neutral views are available before any book is opened. */
export const skinRegistry = createSkinRegistry(readerSkins);

export { vscodeSkin, excelSkin, terminalSkin };
