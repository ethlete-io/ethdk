import { matchesKbdChord } from './kbd-match';

type EventParts = Partial<Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>>;

const keydown = (parts: EventParts) =>
  ({
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...parts,
  }) as KeyboardEvent;

describe('matchesKbdChord', () => {
  it('resolves mod to Command on Apple and Control elsewhere', () => {
    const cmdK = keydown({ key: 'k', code: 'KeyK', metaKey: true });
    const ctrlK = keydown({ key: 'k', code: 'KeyK', ctrlKey: true });

    expect(matchesKbdChord(cmdK, { keys: 'mod+k', platform: 'apple' })).toBe(true);
    expect(matchesKbdChord(cmdK, { keys: 'mod+k', platform: 'other' })).toBe(false);

    expect(matchesKbdChord(ctrlK, { keys: 'mod+k', platform: 'other' })).toBe(true);
    expect(matchesKbdChord(ctrlK, { keys: 'mod+k', platform: 'apple' })).toBe(false);
  });

  it('requires the modifiers to match exactly', () => {
    const cmdShiftK = keydown({ key: 'K', code: 'KeyK', metaKey: true, shiftKey: true });

    expect(matchesKbdChord(cmdShiftK, { keys: 'mod+k', platform: 'apple' })).toBe(false);
    expect(matchesKbdChord(cmdShiftK, { keys: 'mod+shift+k', platform: 'apple' })).toBe(true);
  });

  it('matches an alt chord on macOS, where Option rewrites event.key', () => {
    // Option+K on a US layout reports "˚" as `key`; only `code` still says which key was pressed.
    const optionK = keydown({ key: '˚', code: 'KeyK', altKey: true });

    expect(matchesKbdChord(optionK, { keys: 'alt+k', platform: 'apple' })).toBe(true);
  });

  it('matches a letter by event.key when no code is reported', () => {
    expect(matchesKbdChord(keydown({ key: 'k', metaKey: true }), { keys: 'mod+k', platform: 'apple' })).toBe(true);
  });

  it('matches named keys and their aliases', () => {
    expect(matchesKbdChord(keydown({ key: 'Escape' }), { keys: 'esc', platform: 'other' })).toBe(true);
    expect(matchesKbdChord(keydown({ key: 'Escape' }), { keys: 'escape', platform: 'other' })).toBe(true);
    expect(
      matchesKbdChord(keydown({ key: 'ArrowUp', shiftKey: true }), { keys: 'shift+arrowup', platform: 'other' }),
    ).toBe(true);
    expect(matchesKbdChord(keydown({ key: ' ', ctrlKey: true }), { keys: 'ctrl+space', platform: 'other' })).toBe(true);
  });

  it('accepts cmd and command as spellings of meta', () => {
    const cmdK = keydown({ key: 'k', code: 'KeyK', metaKey: true });

    expect(matchesKbdChord(cmdK, { keys: 'cmd+k', platform: 'other' })).toBe(true);
    expect(matchesKbdChord(cmdK, { keys: 'command+k', platform: 'other' })).toBe(true);
  });

  it('allows Shift on a key that Shift types', () => {
    const questionMark = keydown({ key: '?', metaKey: true, shiftKey: true });

    expect(matchesKbdChord(questionMark, { keys: 'mod+?', platform: 'apple' })).toBe(true);
  });

  it('never matches a chord of modifiers alone', () => {
    expect(matchesKbdChord(keydown({ key: 'Meta', metaKey: true }), { keys: 'mod', platform: 'apple' })).toBe(false);
  });

  it('matches a digit on its physical key', () => {
    expect(
      matchesKbdChord(keydown({ key: '1', code: 'Digit1', ctrlKey: true }), { keys: 'ctrl+1', platform: 'other' }),
    ).toBe(true);
  });
});
