// @vitest-environment-options { "url": "https://app.staging.example.test/" }
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { QueryTestSetup, setupAuthTest, setupQueryTest } from '@ethlete/query/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptToken } from '../utils';
import { withPersistentAuth } from './bearer-auth-persistent-auth';

// Every other spec in this folder mocks the cookie utils away, so none of them can see what a browser
// does with two cookies of one name. This one drives the real jsdom cookie jar instead, which scopes
// cookies the way Chromium does: the host and each of its parent domains hold one cookie each.
vi.mock('@ethlete/core', async () => ({
  ...(await vi.importActual<typeof import('@ethlete/core')>('@ethlete/core')),
  injectRoute: vi.fn(() => signal('/')),
}));

const COOKIE = 'testAuth';
const PARENT_DOMAIN = 'example.test';
const MIDDLE_DOMAIN = 'staging.example.test';
const EXPIRES = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();

const plantCookie = (value: string, domain?: string) => {
  document.cookie = `${COOKIE}=${value}; path=/; expires=${EXPIRES}${domain ? `; domain=${domain}` : ''}`;
};

const dropCookie = (domain?: string) => {
  document.cookie = `${COOKIE}=; path=/${domain ? `; domain=${domain}` : ''}; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
};

const readCookies = () =>
  document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${COOKIE}=`))
    .map((entry) => entry.slice(COOKIE.length + 1));

describe('bearer-auth-persistent-auth cookie scope', () => {
  let setup: QueryTestSetup;

  beforeEach(() => {
    dropCookie();
    dropCookie(MIDDLE_DOMAIN);
    dropCookie(PARENT_DOMAIN);
    localStorage.clear();
    setup = setupQueryTest({ baseUrl: 'https://api.test.com', name: 'test-auth' });
  });

  const startProvider = (domain?: string) =>
    setupAuthTest({
      querySetup: setup,
      features: [
        withPersistentAuth({
          cookie: { name: COOKIE, ...(domain ? { domain } : {}) },
          defaultRememberMe: true,
          autoLogin: {
            queryKey: 'refresh',
            // @ts-expect-error - Type inference issue in setupAuthTest
            buildArgs: (token) => ({ body: { token } }),
          },
        }),
      ],
    });

  const tokenSentToAutoLogin = () => setup.httpTesting.expectOne('https://api.test.com/auth/refresh').request.body;

  it('keeps only the host-only cookie when both scopes hold one', () => {
    plantCookie(encryptToken('stale-token'), PARENT_DOMAIN);
    plantCookie(encryptToken('fresh-token'));

    expect(readCookies()).toHaveLength(2);

    startProvider();

    expect(readCookies()).toEqual([encryptToken('fresh-token')]);
    expect(tokenSentToAutoLogin()).toEqual({ token: 'fresh-token' });
  });

  it('clears a cookie on a domain between the host and the registrable one', () => {
    plantCookie(encryptToken('middle-token'), MIDDLE_DOMAIN);
    plantCookie(encryptToken('parent-token'), PARENT_DOMAIN);
    plantCookie(encryptToken('fresh-token'));

    expect(readCookies()).toHaveLength(3);

    startProvider();

    expect(readCookies()).toEqual([encryptToken('fresh-token')]);
    expect(tokenSentToAutoLogin()).toEqual({ token: 'fresh-token' });
  });

  it('carries a cookie left on the registrable domain over to the host-only scope', () => {
    plantCookie(encryptToken('carried-token'), PARENT_DOMAIN);

    startProvider();

    expect(tokenSentToAutoLogin()).toEqual({ token: 'carried-token' });

    // Dropping the parent domain proves which scope holds the value, which no read of `document.cookie`
    // can tell on its own.
    dropCookie(PARENT_DOMAIN);

    expect(readCookies()).toEqual([encryptToken('carried-token')]);
  });

  it('keeps only the domain cookie when a domain is configured', () => {
    plantCookie(encryptToken('host-only-token'));
    plantCookie(encryptToken('domain-token'), PARENT_DOMAIN);

    startProvider(PARENT_DOMAIN);

    expect(readCookies()).toEqual([encryptToken('domain-token')]);
    expect(tokenSentToAutoLogin()).toEqual({ token: 'domain-token' });
  });

  it('deletes both scopes on logout', () => {
    plantCookie(encryptToken('stale-token'), PARENT_DOMAIN);
    plantCookie(encryptToken('fresh-token'));

    const authSetup = startProvider();

    tokenSentToAutoLogin();
    authSetup.auth.logout();
    TestBed.tick();

    expect(readCookies()).toEqual([]);
  });
});
