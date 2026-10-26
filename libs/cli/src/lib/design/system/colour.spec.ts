import { describe, expect, it } from 'vitest';
import { coloursIn } from './colour';

describe('coloursIn', () => {
  it('finds every hex length and colour function', () => {
    expect(coloursIn('#abc #abcd #aabbcc #aabbccdd')).toEqual(['#abc', '#abcd', '#aabbcc', '#aabbccdd']);
    expect(coloursIn('rgb(0 0 0) rgba( hsl( hsla( hwb( lab( lch( oklab( oklch( color(')).toHaveLength(10);
    expect(coloursIn('var(--x, #fff)')).toEqual(['#fff']);
  });

  it('leaves look-alikes alone', () => {
    expect(coloursIn('#abcde #ab #main #add-button')).toEqual([]);
    expect(coloursIn('&#123; &#x1F;')).toEqual([]);
    expect(coloursIn('https://example.com/#add')).toEqual([]);
    expect(coloursIn('color-mix(in srgb, var(--a), var(--b)) background-color(')).toEqual([]);
  });
});
