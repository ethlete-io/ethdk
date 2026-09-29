import { describe, expect, it } from 'vitest';
import { isQueryDevtoolsShortcut } from '../toggle/query-devtools-shortcut';

const keydown = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { ctrlKey: true, altKey: true, ...init });

describe('isQueryDevtoolsShortcut', () => {
  it('should match the physical Q key whatever character it types', () => {
    expect(isQueryDevtoolsShortcut(keydown({ code: 'KeyQ', key: 'œ' }))).toBe(true);
  });

  it('should match the typed q on a layout that moves it off the physical Q key', () => {
    expect(isQueryDevtoolsShortcut(keydown({ code: 'KeyA', key: 'q' }))).toBe(true);
    expect(isQueryDevtoolsShortcut(keydown({ code: 'KeyA', key: 'Q' }))).toBe(true);
  });

  it('should not match another key', () => {
    expect(isQueryDevtoolsShortcut(keydown({ code: 'KeyW', key: 'w' }))).toBe(false);
  });

  it('should accept Cmd in place of Ctrl', () => {
    expect(isQueryDevtoolsShortcut(keydown({ ctrlKey: false, metaKey: true, code: 'KeyQ', key: 'q' }))).toBe(true);
  });

  it('should require both modifiers', () => {
    expect(isQueryDevtoolsShortcut(keydown({ ctrlKey: false, code: 'KeyQ', key: 'q' }))).toBe(false);
    expect(isQueryDevtoolsShortcut(keydown({ altKey: false, code: 'KeyQ', key: 'q' }))).toBe(false);
  });

  it('should reject AltGr', () => {
    expect(isQueryDevtoolsShortcut(keydown({ modifierAltGraph: true, code: 'KeyQ', key: '@' }))).toBe(false);
  });
});
