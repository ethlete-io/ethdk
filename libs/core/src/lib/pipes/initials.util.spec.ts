import { initials } from './initials.pipe';

describe('initials', () => {
  it('should extract initials from a full name', () => {
    expect(initials('John Doe')).toBe('JD');
  });

  it('should uppercase and cap at two initials by default', () => {
    expect(initials('john doe smith')).toBe('JD');
  });

  it('should respect a custom max length', () => {
    expect(initials('john doe smith', 3)).toBe('JDS');
  });

  it('should handle a single word', () => {
    expect(initials('Madonna')).toBe('M');
  });

  it('should collapse extra whitespace', () => {
    expect(initials('  John   Doe  ')).toBe('JD');
  });

  it('should return an empty string for blank or nullish values', () => {
    expect(initials('   ')).toBe('');
    expect(initials('')).toBe('');
    expect(initials(null)).toBe('');
    expect(initials(undefined)).toBe('');
  });
});
