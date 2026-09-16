import { describe, expect, it } from 'vitest';
import { plain } from './plain-text';

describe('plain', () => {
  it('leaves ordinary text alone', () => {
    expect(plain('FIP-2177  Task  Draw the day')).toBe('FIP-2177  Task  Draw the day');
    expect(plain('Umlaute und Emoji: äöü 🙂')).toBe('Umlaute und Emoji: äöü 🙂');
  });

  it('escapes an escape sequence rather than letting the terminal act on it', () => {
    expect(plain('[2Jcleared')).toBe('\\x1b[2Jcleared');
    expect(plain('one\rtwo')).toBe('one\\x0dtwo');
    expect(plain('31mred')).toBe('\\x9b31mred');
    expect(plain('bell')).toBe('bell\\x07');
  });

  it('keeps the two control characters a line is made of', () => {
    expect(plain('key\tvalue\n')).toBe('key\tvalue\n');
  });
});
