import { HttpBackend, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  registerQueryErrorParser,
  withDefaultRetry,
  withEthleteApiErrors,
  withHtmlErrorParsing,
  withSymfonyErrors,
  withSuccessHandling,
} from '../index';
import { createScenario, sequence, useScenario } from './harness';

// Error parsers are installed process-wide (see apps/docs/query/errors.md), not per client -
// `registerQueryErrorParser` is a module-level singleton that is never reset between tests in this file.
// Describe blocks below are ordered so that the one asserting the unparsed baseline runs first, before any
// later block opts a client into a parser that would otherwise leak into it.

describe('baseline error normalization (no client features)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('normalizes a 500 with a JSON { message } body into the documented QueryErrorResponse shape', () => {
    const s = scenario();
    s.api.on('GET', '/broken', () => ({ status: 500, body: { message: 'Internal error occurred' } }));

    const getBroken = s.get<{ response: unknown }>('/broken');
    const c = s.consumer();
    const query = c.run(() => getBroken());

    s.tick();

    expect(query.response()).toBeNull();
    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe('Internal error occurred');
    expect(error?.code).toBe(500);
    expect(error?.raw).toBeInstanceOf(HttpErrorResponse);
    expect(error?.retryState).toEqual({ retry: false });

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('clears error() after a manual re-execute that now succeeds', () => {
    const s = scenario();
    s.api.on('GET', '/flaky-once', sequence([{ status: 500, body: { message: 'temporary' } }, { body: { ok: true } }]));

    const getFlakyOnce = s.get<{ response: { ok: boolean } }>('/flaky-once');
    const c = s.consumer();
    const query = c.run(() => getFlakyOnce());

    s.tick();

    expect(query.error()?.code).toBe(500);
    expect(query.response()).toBeNull();

    c.run(() => query.execute());
    s.tick();

    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });
});

describe('connection failures (status 0)', () => {
  it('sets error() and clears loading() on a network failure', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    // The fake API's `on()` handler always answers through `HttpResponse` / `HttpErrorResponse` with an
    // explicit status, and its own delivery path only treats a status >= 400 as an error (see
    // `fake-api.ts` `handle()`), so a status of `0` - a real connection failure - can never be produced
    // through it. Worked around here with a dedicated `HttpBackend` that fails the way a dropped
    // connection does, bypassing the fake API for this one scenario. Reported as a harness gap.
    const failingBackend: HttpBackend = {
      handle: () =>
        new Observable((subscriber) => {
          const timer = setTimeout(
            () =>
              subscriber.error(
                new HttpErrorResponse({ status: 0, statusText: 'Unknown Error', url: 'https://api.test/offline' }),
              ),
            0,
          );

          return () => clearTimeout(timer);
        }),
    };

    const scenario = createScenario({
      clientOptions: { keepUnusedFor: 0 },
      providers: [{ provide: HttpBackend, useValue: failingBackend }],
    });

    const s = scenario();
    const getOffline = s.get<{ response: unknown }>('/offline');
    const c = s.consumer();
    const query = c.run(() => getOffline());

    s.tick();

    expect(query.response()).toBeNull();
    expect(query.loading()).toBeNull();
    expect(query.error()?.code).toBe(0);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 0);

    c.destroy();
    s.destroy();

    vi.useRealTimers();
  });
});

describe('HTML error pages (withHtmlErrorParsing)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withHtmlErrorParsing()],
  });

  it('parses the readable text out of an HTML error page', () => {
    const s = scenario();
    s.api.on('GET', '/proxy-down', () => ({
      status: 502,
      body: '<h1>Service Unavailable</h1><p>The server is currently restarting.</p>',
    }));

    const getProxyDown = s.get<{ response: unknown }>('/proxy-down');
    const c = s.consumer();
    const query = c.run(() => getProxyDown());

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(false);
    expect(error && !error.isList ? error.error.message : null).toBe(
      'Service Unavailable: The server is currently restarting.',
    );
    expect(error?.code).toBe(502);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 502);
    c.destroy();
  });
});

describe('Symfony violations (withSymfonyErrors)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withSymfonyErrors()],
  });

  it('turns a Symfony violation list into the documented QueryErrorResponse violation list', () => {
    const s = scenario();
    s.api.on('POST', '/users', () => ({
      status: 422,
      body: {
        violations: [
          { message: 'This value should not be blank.', propertyPath: 'email', invalidValue: null },
          { message: 'This value is too short.', propertyPath: 'name', invalidValue: 'Al' },
        ],
      },
    }));

    const createUser = s.post<{ response: unknown; body: { email: string; name: string } }>('/users');
    const c = s.consumer();
    const query = c.run(() => createUser());
    c.run(() => query.execute({ args: { body: { email: '', name: 'Al' } } }));

    s.tick();

    const error = query.error();
    expect(error?.isList).toBe(true);
    expect(error && error.isList ? error.errors.map((e) => e.message) : null).toEqual([
      'This value should not be blank.',
      'This value is too short.',
    ]);
    expect(error?.code).toBe(422);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);
    c.destroy();
  });
});

describe('withEthleteApiErrors (html + symfony + retry in one feature)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withEthleteApiErrors()],
  });

  it('parses a Symfony violation payload and retries a 503, both from the single feature', () => {
    const s = scenario();
    s.api.on('POST', '/orders', () => ({
      status: 422,
      body: { violations: [{ message: 'Quantity must be positive.', propertyPath: 'quantity', invalidValue: -1 }] },
    }));
    s.api.on('GET', '/reports', () => ({ status: 503, body: { message: 'unavailable' } }));

    const createOrder = s.post<{ response: unknown; body: { quantity: number } }>('/orders');
    const getReports = s.get<{ response: unknown }>('/reports');

    const a = s.consumer();
    const orderQuery = a.run(() => createOrder());
    a.run(() => orderQuery.execute({ args: { body: { quantity: -1 } } }));

    const b = s.consumer();
    const reportsQuery = b.run(() => getReports());

    s.tick();

    const orderError = orderQuery.error();
    expect(orderError?.isList).toBe(false);
    expect(orderError && !orderError.isList ? orderError.error.message : null).toBe('Quantity must be positive.');

    expect(reportsQuery.error()).toBeNull();
    expect(reportsQuery.response()).toBeNull();
    expect(reportsQuery.loading()).not.toBeNull();

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 422);

    a.destroy();
    b.destroy();
  });
});

describe('the default retry policy (withDefaultRetry)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ jitter: 0 })],
  });

  it('retries a 503 with the documented exponential backoff (2s, 4s, 8s) and recovers on success', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/flaky-retry',
      sequence([{ status: 503 }, { status: 503 }, { status: 503 }, { body: { ok: true } }]),
    );

    const getFlakyRetry = s.get<{ response: { ok: boolean } }>('/flaky-retry');
    const c = s.consumer();
    const query = c.run(() => getFlakyRetry());

    // Each stage below advances by the retry policy's own backoff delay, then ticks 1ms further: the
    // attempt sent at the end of the big tick answers through its own 0ms-delay fake-API response timer,
    // scheduled (mid-`advanceTimersByTime`) for exactly the clock value that call is advancing to - and a
    // timer newly created at exactly that boundary is not re-examined within the same `advanceTimersByTime`
    // call, only a later one. The 1ms flush is what crosses that boundary and lets the *next* backoff get
    // scheduled from the response it unblocks.
    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(1);
    expect(query.response()).toBeNull();

    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(2);

    s.tick(4000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(3);

    s.tick(8000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/flaky-retry')).toBe(4);
    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    c.destroy();
  });

  it('does not retry a 400', () => {
    const s = scenario();
    s.api.on('GET', '/bad-request', () => ({ status: 400, body: { message: 'Bad input' } }));

    const getBadRequest = s.get<{ response: unknown }>('/bad-request');
    const c = s.consumer();
    const query = c.run(() => getBadRequest());

    s.tick();

    expect(query.error()?.code).toBe(400);
    expect(query.error()?.retryState).toEqual({ retry: false });
    expect(s.api.requestCount('GET', '/bad-request')).toBe(1);

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/bad-request')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('stops retrying after the documented maximum (3) and surfaces the final error', () => {
    const s = scenario();
    s.api.on('GET', '/always-503', () => ({ status: 503, body: { message: 'down' } }));

    const getAlways503 = s.get<{ response: unknown }>('/always-503');
    const c = s.consumer();
    const query = c.run(() => getAlways503());

    s.tick();
    s.tick(1);
    s.tick(2000);
    s.tick(1);
    s.tick(4000);
    s.tick(1);
    s.tick(8000);
    s.tick(1);

    expect(s.api.requestCount('GET', '/always-503')).toBe(4);
    expect(query.error()?.code).toBe(503);
    expect(query.error()?.retryState).toEqual({ retry: false });

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/always-503')).toBe(4);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);
    c.destroy();
  });

  it('does not retry a 500', () => {
    const s = scenario();
    s.api.on('GET', '/internal-error', () => ({ status: 500, body: { message: 'boom' } }));

    const getInternalError = s.get<{ response: unknown }>('/internal-error');
    const c = s.consumer();
    const query = c.run(() => getInternalError());

    s.tick();

    expect(query.error()?.code).toBe(500);
    expect(query.error()?.retryState).toEqual({ retry: false });
    expect(s.api.requestCount('GET', '/internal-error')).toBe(1);

    s.tick(30_000);
    expect(s.api.requestCount('GET', '/internal-error')).toBe(1);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
    c.destroy();
  });

  it('retries a 408, a 425 and a 429 (no retry-after header) using the default backoff', () => {
    const s = scenario();
    s.api.on('GET', '/timeout', sequence([{ status: 408 }, { body: { ok: true } }]));
    s.api.on('GET', '/too-early', sequence([{ status: 425 }, { body: { ok: true } }]));
    s.api.on('GET', '/rate-limited-plain', sequence([{ status: 429 }, { body: { ok: true } }]));

    const getTimeout = s.get<{ response: { ok: boolean } }>('/timeout');
    const getTooEarly = s.get<{ response: { ok: boolean } }>('/too-early');
    const getRateLimited = s.get<{ response: { ok: boolean } }>('/rate-limited-plain');

    const a = s.consumer();
    const b = s.consumer();
    const d = s.consumer();
    const timeoutQuery = a.run(() => getTimeout());
    const tooEarlyQuery = b.run(() => getTooEarly());
    const rateLimitedQuery = d.run(() => getRateLimited());

    s.tick();
    s.tick(1);
    expect(s.api.requestCount('GET', '/timeout')).toBe(1);
    expect(s.api.requestCount('GET', '/too-early')).toBe(1);
    expect(s.api.requestCount('GET', '/rate-limited-plain')).toBe(1);

    s.tick(2000);
    s.tick(1);

    expect(s.api.requestCount('GET', '/timeout')).toBe(2);
    expect(s.api.requestCount('GET', '/too-early')).toBe(2);
    expect(s.api.requestCount('GET', '/rate-limited-plain')).toBe(2);
    expect(timeoutQuery.response()).toEqual({ ok: true });
    expect(tooEarlyQuery.response()).toEqual({ ok: true });
    expect(rateLimitedQuery.response()).toEqual({ ok: true });

    a.destroy();
    b.destroy();
    d.destroy();
  });

  it('honors a retry-after header in seconds for a 429, ahead of the exponential backoff', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-after',
      sequence([{ status: 429, headers: { 'retry-after': '5' } }, { body: { ok: true } }]),
    );

    const getRateLimitedAfter = s.get<{ response: { ok: boolean } }>('/rate-limited-after');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedAfter());

    s.tick();
    s.tick(1);

    // The default backoff's first delay is 2000ms - flushing past it and its own boundary tick without
    // a second request proves the header (5000ms), not the exponential schedule, is driving the wait.
    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-after')).toBe(1);

    s.tick(3000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-after')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('honors an x-retry-after header the same way', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-x',
      sequence([{ status: 429, headers: { 'x-retry-after': '3' } }, { body: { ok: true } }]),
    );

    const getRateLimitedX = s.get<{ response: { ok: boolean } }>('/rate-limited-x');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedX());

    s.tick();
    s.tick(1);

    s.tick(2000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-x')).toBe(1);

    s.tick(1000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-x')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('caps a retry-after delay at the documented maximum (30s)', () => {
    const s = scenario();
    s.api.on(
      'GET',
      '/rate-limited-huge',
      sequence([{ status: 429, headers: { 'retry-after': '999999' } }, { body: { ok: true } }]),
    );

    const getRateLimitedHuge = s.get<{ response: { ok: boolean } }>('/rate-limited-huge');
    const c = s.consumer();
    const query = c.run(() => getRateLimitedHuge());

    s.tick();
    s.tick(1);

    s.tick(30_000);
    s.tick(1);
    expect(s.api.requestCount('GET', '/rate-limited-huge')).toBe(2);
    expect(query.response()).toEqual({ ok: true });

    c.destroy();
  });

  it('cancels the in-flight retry timer when the consumer is destroyed mid-backoff', () => {
    const s = scenario();
    s.api.on('GET', '/always-503-b', () => ({ status: 503, body: { message: 'down' } }));

    const getAlways503 = s.get<{ response: unknown }>('/always-503-b');
    const c = s.consumer();
    c.run(() => getAlways503());

    s.tick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    c.destroy();

    // Angular's change detection scheduler arms a zero-delay timer after the last signal write; only
    // the retry timer is under test here.
    s.tick(1);

    expect(vi.getTimerCount()).toBe(0);
    expect(s.api.pending().length).toBe(0);
  });
});

describe('connection failures are retried by the default policy', () => {
  it('retries a status-0 network failure and recovers', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });

    let attempt = 0;
    const flakyOfflineBackend: HttpBackend = {
      handle: () =>
        new Observable((subscriber) => {
          const timer = setTimeout(() => {
            attempt++;

            if (attempt === 1) {
              subscriber.error(
                new HttpErrorResponse({
                  status: 0,
                  statusText: 'Unknown Error',
                  url: 'https://api.test/offline-retry',
                }),
              );
              return;
            }

            subscriber.next(
              new HttpResponse({ status: 200, url: 'https://api.test/offline-retry', body: { ok: true } }),
            );
            subscriber.complete();
          }, 0);

          return () => clearTimeout(timer);
        }),
    };

    const scenario = createScenario({
      clientOptions: { keepUnusedFor: 0 },
      clientFeatures: [withDefaultRetry({ jitter: 0 })],
      providers: [{ provide: HttpBackend, useValue: flakyOfflineBackend }],
    });

    const s = scenario();
    const getOfflineRetry = s.get<{ response: { ok: boolean } }>('/offline-retry');
    const c = s.consumer();
    const query = c.run(() => getOfflineRetry());

    s.tick();
    s.tick(1);
    expect(query.response()).toBeNull();

    s.tick(2000);
    s.tick(1);

    expect(query.response()).toEqual({ ok: true });
    expect(query.error()).toBeNull();

    c.destroy();
    s.destroy();

    vi.useRealTimers();
  });
});

describe('an unlimited default retry policy', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withDefaultRetry({ jitter: 0, maxAttempts: 0 })],
  });

  it('keeps a retryable request loading beyond the normal attempt limit', () => {
    const s = scenario();
    s.api.on('GET', '/retry-forever', () => ({ status: 503, body: { message: 'down' } }));

    const getRetryForever = s.get<{ response: unknown }>('/retry-forever');
    const c = s.consumer();
    const query = c.run(() => getRetryForever());

    for (const delay of [0, 2_000, 4_000, 8_000, 16_000]) {
      s.tick(delay);
      s.tick(1);
    }

    expect(s.api.requestCount('GET', '/retry-forever')).toBe(5);
    expect(query.loading()).not.toBeNull();
    expect(query.error()).toBeNull();
    expect(query.executionState()?.type).toBe('loading');

    c.destroy();
    s.tick(1);
  });
});

describe('custom error parsers (registerQueryErrorParser)', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  // `registerQueryErrorParser` installs process-wide and is never reset (see the file header), so both
  // parsers below only ever act on a body carrying this file's own marker field - never on another
  // scenario file's response shapes, past or future.
  it('lets a custom parser ahead of the built-in ladder shape error(), and a null result fall through to the next one', () => {
    const s = scenario();

    registerQueryErrorParser((detail) =>
      typeof detail === 'object' && !!detail && 'errorsSpecMarker' in detail && detail.errorsSpecMarker === 'first'
        ? ['handled by the first parser']
        : null,
    );
    registerQueryErrorParser((detail) =>
      typeof detail === 'object' && !!detail && 'errorsSpecMarker' in detail && detail.errorsSpecMarker === 'second'
        ? ['handled by the second parser']
        : null,
    );

    s.api.on('GET', '/custom-parser-first', () => ({ status: 400, body: { errorsSpecMarker: 'first' } }));
    s.api.on('GET', '/custom-parser-second', () => ({ status: 400, body: { errorsSpecMarker: 'second' } }));

    const getFirst = s.get<{ response: unknown }>('/custom-parser-first');
    const getSecond = s.get<{ response: unknown }>('/custom-parser-second');

    const a = s.consumer();
    const b = s.consumer();
    const firstQuery = a.run(() => getFirst());
    const secondQuery = b.run(() => getSecond());

    s.tick();

    const firstError = firstQuery.error();
    expect(firstError?.isList).toBe(false);
    expect(firstError && !firstError.isList ? firstError.error.message : null).toBe('handled by the first parser');

    // The first parser returns null for this body (marker is 'second', not 'first'), so it falls
    // through to the second - proving a null result passes the body on rather than ending the search.
    const secondError = secondQuery.error();
    expect(secondError?.isList).toBe(false);
    expect(secondError && !secondError.isList ? secondError.error.message : null).toBe('handled by the second parser');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);

    a.destroy();
    b.destroy();
  });
});

describe('HTML error parsing edge cases (withHtmlErrorParsing)', () => {
  const scenario = useScenario({
    clientOptions: { keepUnusedFor: 0 },
    clientFeatures: [withHtmlErrorParsing()],
  });

  it('falls back to <title> when the page has no heading', () => {
    const s = scenario();
    s.api.on('GET', '/html-title-fallback', () => ({
      status: 400,
      body: '<html><head><title>Site Down</title></head><body><p>Try again soon.</p></body></html>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-title-fallback');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Site Down: Try again soon.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('excludes <script> and <style> content from the extracted message', () => {
    const s = scenario();
    s.api.on('GET', '/html-noise', () => ({
      status: 400,
      body:
        '<style>.foo{color:red}</style><h1>Maintenance</h1><script>doEvilThings()</script>' +
        '<p>We are updating things.</p>',
    }));

    const getPage = s.get<{ response: unknown }>('/html-noise');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    const message = error && !error.isList ? error.error.message : null;
    expect(message).toBe('Maintenance: We are updating things.');
    expect(message).not.toContain('doEvilThings');
    expect(message).not.toContain('color:red');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it('caps the extracted message at 300 characters', () => {
    const s = scenario();
    const longSentence = 'a'.repeat(400);
    s.api.on('GET', '/html-too-long', () => ({ status: 400, body: `<p>${longSentence}</p>` }));

    const getPage = s.get<{ response: unknown }>('/html-too-long');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    const message = error && !error.isList ? error.error.message : null;
    expect(message?.length).toBeLessThanOrEqual(300);
    expect(message?.endsWith('…')).toBe(true);

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });

  it("parses the { error, text } wrapper Angular's XHR backend produces for a mis-parsed body", () => {
    const s = scenario();
    s.api.on('GET', '/html-wrapper', () => ({
      status: 400,
      body: { error: new Error('Unexpected token <'), text: '<h1>Bad Gateway</h1><p>Try later.</p>' },
    }));

    const getPage = s.get<{ response: unknown }>('/html-wrapper');
    const c = s.consumer();
    const query = c.run(() => getPage());

    s.tick();

    const error = query.error();
    expect(error && !error.isList ? error.error.message : null).toBe('Bad Gateway: Try later.');

    s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 400);
    c.destroy();
  });
});

describe('a transformResponse that throws', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  type TransformArgs = { response: { name: string }; rawResponse: { data?: { name: string } } };

  it('a throwing transformResponse fails the query and does not run success handlers', () => {
    const s = scenario();
    s.api.on('GET', '/transform', sequence([{ body: { data: { name: 'ok' } } }, { body: {} }]));

    const getTransformed = s.get<TransformArgs>('/transform', {
      transformResponse: (raw) => {
        if (!raw.data) throw new Error('unmappable response');

        return raw.data;
      },
    });

    const handled: unknown[] = [];
    const c = s.consumer();
    const query = c.run(() => getTransformed(withSuccessHandling<TransformArgs>({ handler: (r) => handled.push(r) })));

    s.tick();
    expect(handled).toEqual([{ name: 'ok' }]);

    query.execute();
    s.tick();

    expect(query.executionState()?.type).toBe('failure');
    expect(query.error()?.code).toBe(0);
    expect(handled).toEqual([{ name: 'ok' }]);

    c.destroy();
  });
});
