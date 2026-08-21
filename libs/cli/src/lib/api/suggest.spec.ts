import { describe, expect, it } from 'vitest';
import { closestMatch, didYouMean } from './suggest';

const APIS = ['hub', 'platform'];

describe('closestMatch', () => {
  it('finds the name behind one wrong letter', () => {
    expect(closestMatch('platforn', APIS)).toBe('platform');
  });

  it('finds the name behind two swapped letters', () => {
    expect(closestMatch('platfrom', APIS)).toBe('platform');
  });

  it('ignores case', () => {
    expect(closestMatch('Platform', APIS)).toBe('platform');
  });

  it('accepts one edit in a short name', () => {
    expect(closestMatch('hup', APIS)).toBe('hub');
  });

  it('suggests nothing for a word that is not close to any candidate', () => {
    expect(closestMatch('backend', APIS)).toBeUndefined();
  });

  it('suggests nothing when there are no candidates', () => {
    expect(closestMatch('hub', [])).toBeUndefined();
  });
});

describe('didYouMean', () => {
  it('is a sentence when a candidate is close', () => {
    expect(didYouMean('hup', APIS)).toBe(' Did you mean "hub"?');
  });

  it('is empty when none is', () => {
    expect(didYouMean('backend', APIS)).toBe('');
  });
});
