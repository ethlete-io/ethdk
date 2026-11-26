import { slugify } from './slugify.pipe';

describe('slugify', () => {
  it('should lowercase and hyphenate words', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('should strip diacritics', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
    expect(slugify('FC Bayern München')).toBe('fc-bayern-munchen');
  });

  it('should collapse runs of non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('foo_bar / baz')).toBe('foo-bar-baz');
    expect(slugify('a---b')).toBe('a-b');
  });

  it('should trim leading and trailing separators and whitespace', () => {
    expect(slugify('  Hello World!  ')).toBe('hello-world');
    expect(slugify('!!!wow!!!')).toBe('wow');
  });

  it('should return an empty string for blank or nullish values', () => {
    expect(slugify('   ')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});
