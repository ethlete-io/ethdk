// @vitest-environment node

import { deleteCookie, getCookie, getDomain, hasCookie, setCookie } from './cookie';

describe('cookies on the server', () => {
  it('runs where there is a global navigator but no window or document', () => {
    expect(typeof navigator).toBe('object');
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('has no domain to derive', () => {
    expect(getDomain()).toBeNull();
  });

  it('reads nothing', () => {
    expect(hasCookie('a')).toBe(false);
    expect(getCookie('a')).toBeNull();
  });

  it('writes nothing', () => {
    expect(() => setCookie('a', 'b')).not.toThrow();
    expect(() => setCookie('a', 'b', 1, 'example.com')).not.toThrow();
    expect(() => deleteCookie('a')).not.toThrow();
  });
});
