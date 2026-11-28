import { describe, expect, it } from 'vitest';
import { coloursIn } from './colour';

describe('coloursIn', () => {
  it('finds every hex length and colour function', () => {
    expect(coloursIn('#abc #abcd #aabbcc #aabbccdd')).toEqual(['#abc', '#abcd', '#aabbcc', '#aabbccdd']);
    expect(coloursIn('rgb(0 0 0) rgba( hsl( hsla( hwb( lab( lch( oklab( oklch( color(')).toHaveLength(10);
    expect(coloursIn('var(--x, #fff)')).toEqual(['#fff']);
  });

  it('leaves an rgb() alone when every channel comes from a token, with a literal alpha', () => {
    expect(
      coloursIn(
        'rgb(var(--shadow-rgb) / 0.25) rgba(var(--shadow-rgb), 0.5) rgb(var(--r) var(--g) var(--b)) rgb(var(--c, var(--d)))',
      ),
    ).toEqual([]);
  });

  it('still finds an rgb() with a literal channel, or with nothing to come from', () => {
    expect(coloursIn('rgb(0 0 var(--b)) rgba(0, 0, 0, var(--a)) rgb() oklch(var(--l) 0 0')).toEqual([
      'rgb(',
      'rgba(',
      'rgb(',
      'oklch(',
    ]);
  });

  it('leaves look-alikes alone', () => {
    expect(coloursIn('#abcde #ab #main #add-button')).toEqual([]);
    expect(coloursIn('&#123; &#x1F;')).toEqual([]);
    expect(coloursIn('https://example.com/#add')).toEqual([]);
    expect(coloursIn('color-mix(in srgb, var(--a), var(--b)) background-color(')).toEqual([]);
  });
});
