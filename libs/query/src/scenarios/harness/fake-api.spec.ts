import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApi, FakeApi, sequence } from './fake-api';
import { mintToken } from './tokens';

const BASE_URL = 'https://api.test';

describe('fake-api', () => {
  let api: FakeApi;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    api = createFakeApi({ baseUrl: BASE_URL });
  });

  const send = (method: string, url: string, body: unknown = null, headers: Record<string, string> = {}) => {
    const req = new HttpRequest(method, `${BASE_URL}${url}`, body, { headers: new HttpHeaders(headers) });
    const events: unknown[] = [];
    let error: unknown = null;
    let completed = false;

    const subscription = api.backend.handle(req).subscribe({
      next: (event) => events.push(event),
      error: (e) => (error = e),
      complete: () => (completed = true),
    });

    return { events, subscription, getError: () => error, isCompleted: () => completed };
  };

  it('resolves a matching route after the configured delay', () => {
    api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

    const { events, isCompleted } = send('GET', '/users/1');

    expect(events).toEqual([]);
    vi.advanceTimersByTime(0);

    expect(isCompleted()).toBe(true);
    expect((events[0] as HttpResponse<unknown>).body).toEqual({ id: '1' });
    expect(api.requestCount('GET', '/users/1')).toBe(1);
  });

  it('delivers nothing before the configured delay elapses', () => {
    api.on('GET', '/slow', () => ({ body: [], delay: 500 }));

    const { isCompleted } = send('GET', '/slow');

    vi.advanceTimersByTime(499);
    expect(isCompleted()).toBe(false);

    vi.advanceTimersByTime(1);
    expect(isCompleted()).toBe(true);
  });

  it('turns a status >= 400 response into an HttpErrorResponse', () => {
    api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));

    const { getError } = send('GET', '/broken');
    vi.advanceTimersByTime(0);

    const error = getError();
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(500);
  });

  it('consumes a once() handler after a single match, falling back to on()', () => {
    api.on('GET', '/users/1', () => ({ body: { id: '1', from: 'default' } }));
    api.once('GET', '/users/1', () => ({ status: 404 }));

    const first = send('GET', '/users/1');
    vi.advanceTimersByTime(0);
    expect(first.getError()).toBeInstanceOf(HttpErrorResponse);

    const second = send('GET', '/users/1');
    vi.advanceTimersByTime(0);
    expect((second.events[0] as HttpResponse<unknown>).body).toEqual({ id: '1', from: 'default' });
  });

  it('marks an unsubscribed pending request as aborted and removes it from pending()', () => {
    api.on('GET', '/slow', () => ({ body: [], delay: 500 }));

    const { subscription } = send('GET', '/slow');
    expect(api.pending().length).toBe(1);

    subscription.unsubscribe();

    expect(api.pending().length).toBe(0);
    expect(api.requests[0]?.aborted).toBe(true);
  });

  it('rejects a protected route without a valid bearer token, and allows one that satisfies the guard', () => {
    api.protect('/admin/**', (token) => token.claims['role'] === 'admin');
    api.on('GET', '/admin/users', () => ({ body: [] }));

    const unauthenticated = send('GET', '/admin/users');
    vi.advanceTimersByTime(0);
    expect((unauthenticated.getError() as HttpErrorResponse).status).toBe(401);

    const wrongRole = send('GET', '/admin/users', null, {
      Authorization: `Bearer ${mintToken({ claims: { role: 'user' } })}`,
    });
    vi.advanceTimersByTime(0);
    expect((wrongRole.getError() as HttpErrorResponse).status).toBe(401);

    const admin = send('GET', '/admin/users', null, {
      Authorization: `Bearer ${mintToken({ claims: { role: 'admin' } })}`,
    });
    vi.advanceTimersByTime(0);
    expect(admin.getError()).toBeNull();
    expect(admin.isCompleted()).toBe(true);
  });

  it('cycles through a sequence() handler and holds on the last response', () => {
    api.on('GET', '/flaky', sequence([{ status: 503 }, { status: 503 }, { body: 'ok' }]));

    for (let i = 0; i < 2; i++) {
      const { getError } = send('GET', '/flaky');
      vi.advanceTimersByTime(0);
      expect((getError() as HttpErrorResponse).status).toBe(503);
    }

    const third = send('GET', '/flaky');
    vi.advanceTimersByTime(0);
    expect((third.events[0] as HttpResponse<unknown>).body).toBe('ok');

    const fourth = send('GET', '/flaky');
    vi.advanceTimersByTime(0);
    expect((fourth.events[0] as HttpResponse<unknown>).body).toBe('ok');
  });

  it('resets routes, one-shots and the request log', () => {
    api.on('GET', '/users', () => ({ body: [] }));
    send('GET', '/users');
    vi.advanceTimersByTime(0);

    api.reset();

    expect(api.requests.length).toBe(0);
    expect(() => {
      const { getError } = send('GET', '/users');
      vi.advanceTimersByTime(0);
      // consumed synchronously inside the Observable constructor and delivered as an error notification
      expect(getError()).toBeInstanceOf(Error);
    }).not.toThrow();
  });
});
