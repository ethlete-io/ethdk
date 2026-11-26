// @vitest-environment-options { "url": "https://app.example.co.uk/" }
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCookie, getCookie, setCookie } from './cookie';

const NAME = 'suffixCookie';

const clear = () => {
  document.cookie = `${NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
};

describe('cookie on a public-suffix host', () => {
  beforeEach(clear);

  it('falls back to a host-only cookie when the derived domain is refused', () => {
    setCookie(NAME, 'value');

    expect(getCookie(NAME)).toBe('value');

    deleteCookie(NAME);

    expect(getCookie(NAME)).toBeNull();
  });

  it('round-trips values containing separators', () => {
    setCookie(NAME, 'a;b,c=d é', null, null);

    expect(getCookie(NAME)).toBe('a;b,c=d é');
  });
});
