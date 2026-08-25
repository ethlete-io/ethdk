// @vitest-environment-options { "url": "https://app.example.test/" }
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteCookie, getCookie, getDomain, hasCookie, setCookie } from './cookie';

// The other cookie spec spies on the `document.cookie` setter, so it sees the string a call builds but
// never what a cookie jar does with it. These run against the real jar of a subdomain host, where a
// host-only cookie and one on the registrable domain are two cookies of the same name.
const NAME = 'testCookie';

const dropCookie = (domain?: string) => {
  document.cookie = `${NAME}=; path=/${domain ? `; domain=${domain}` : ''}; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
};

const cookieValues = () =>
  document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${NAME}=`))
    .map((entry) => entry.slice(NAME.length + 1));

describe('cookie scope', () => {
  beforeEach(() => {
    dropCookie();
    dropCookie('example.test');
  });

  it('reads the registrable domain of a subdomain host', () => {
    expect(getDomain()).toBe('example.test');
  });

  it('writes a second cookie instead of replacing the one in the other scope', () => {
    setCookie(NAME, 'domainValue', 30, 'example.test');
    setCookie(NAME, 'hostOnlyValue', 30, null);

    expect(cookieValues().sort()).toEqual(['domainValue', 'hostOnlyValue']);
  });

  it('hands back one of the two values, and which one is not ours to pick', () => {
    setCookie(NAME, 'domainValue', 30, 'example.test');
    setCookie(NAME, 'hostOnlyValue', 30, null);

    expect(hasCookie(NAME)).toBe(true);
    expect(['domainValue', 'hostOnlyValue']).toContain(getCookie(NAME));
  });

  it('deletes the scope it is given and leaves the other one', () => {
    setCookie(NAME, 'domainValue', 30, 'example.test');
    setCookie(NAME, 'hostOnlyValue', 30, null);

    deleteCookie(NAME, '/', 'example.test');

    expect(cookieValues()).toEqual(['hostOnlyValue']);

    deleteCookie(NAME, '/', null);

    expect(cookieValues()).toEqual([]);
  });
});
