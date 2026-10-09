import { describe, expect, it } from 'vitest';
import { acceleratorsConflict, matchesAccelerator } from './keys.js';

function keyEvent(init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  } as KeyboardEvent;
}

describe('matchesAccelerator', () => {
  it('matches the default quick switch combination', () => {
    const event = keyEvent({ key: 'q', ctrlKey: true, altKey: true, shiftKey: true });
    expect(matchesAccelerator(event, 'CommandOrControl+Alt+Shift+Q')).toBe(true);
  });

  it('rejects when a modifier is missing', () => {
    const event = keyEvent({ key: 'q', ctrlKey: true, altKey: true });
    expect(matchesAccelerator(event, 'CommandOrControl+Alt+Shift+Q')).toBe(false);
  });

  it('matches function-style keys used for chapter navigation', () => {
    const event = keyEvent({ key: 'ArrowRight', altKey: true });
    expect(matchesAccelerator(event, 'Alt+ArrowRight')).toBe(true);
  });
});

describe('acceleratorsConflict', () => {
  it('treats reordered modifiers as the same binding', () => {
    expect(acceleratorsConflict('Alt+Shift+Q', 'Shift+Alt+Q')).toBe(true);
    expect(acceleratorsConflict('Alt+Shift+Q', 'Alt+Shift+W')).toBe(false);
  });
});
