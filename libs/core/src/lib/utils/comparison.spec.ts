import { clone, equal } from './comparison';

describe('comparison utilities', () => {
  it('compares plain objects with different object prototypes', () => {
    const dictionary = Object.assign(Object.create(null) as Record<string, number>, { value: 1 });

    expect(equal(dictionary, { value: 1 })).toBe(true);
    expect(equal({ value: 1 }, dictionary)).toBe(true);
  });

  it('clones circular values', () => {
    const value: { label: string; self?: unknown } = { label: 'root' };
    value.self = value;

    const cloned = clone(value);

    expect(cloned).not.toBe(value);
    expect(cloned.self).toBe(cloned);
  });

  it('compares Dates by time rather than constructor identity', () => {
    expect(equal(new Date(0), new Date(999))).toBe(false);
    expect(equal(new Date(999), new Date(999))).toBe(true);
  });

  it('compares Dates by time under a faked global Date constructor', () => {
    vi.useFakeTimers({ toFake: ['Date'] });

    expect(equal(new Date(0), new Date(999))).toBe(false);
    expect(equal(new Date(999), new Date(999))).toBe(true);

    vi.useRealTimers();
  });
});
