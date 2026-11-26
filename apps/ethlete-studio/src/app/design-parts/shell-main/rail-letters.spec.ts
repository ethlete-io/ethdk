import { describe, expect, it } from 'vitest';
import { railLetters } from './rail-letters';

describe('railLetters', () => {
  it('gives studio, studio-lab and sdk three different labels', () => {
    expect(railLetters(['studio', 'studio-lab', 'sdk'])).toEqual(['St', 'Sl', 'Sd']);
  });

  it('keeps the first letter capitalised and the second lower case', () => {
    expect(railLetters(['timetrack', 'docs'])).toEqual(['Ti', 'Do']);
  });

  it('never repeats a label within one rail', () => {
    const labels = railLetters(['sdk', 'sdl', 'sd-lab']);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('falls back to the first letter for a one-letter name', () => {
    expect(railLetters(['x'])).toEqual(['X']);
  });
});
