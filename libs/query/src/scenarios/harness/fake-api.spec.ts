import { HttpErrorResponse, HttpEventType, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApi, FakeApi, sequence } from './fake-api';
import { createFakeXhr } from './fake-xhr';
import { mintToken } from './tokens';

const BASE_URL = 'https://api.test';

describe('fake-api', () => {
  let api: FakeApi;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    api = createFakeApi({ baseUrl: BASE_URL });
  });

  const send = (
    method: string,
    url: string,
    body: unknown = null,
    headers: Record<string, string> = {},
    init: { withCredentials?: boolean; reportProgress?: boolean; responseType?: 'json' | 'text' } = {},
  ) => {
    const req = new HttpRequest(method, `${BASE_URL}${url}`, body, { headers: new HttpHeaders(headers), ...init });
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

  it('turns a status 0 response into a network-error HttpErrorResponse', () => {
    api.on('GET', '/offline', () => ({ status: 0 }));

    const { getError } = send('GET', '/offline');
    vi.advanceTimersByTime(0);

    const error = getError();
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(0);
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

  it('does not consume a once route for a request the protect guard rejects', () => {
    api.protect('/secret');
    api.once('GET', '/secret', () => ({ body: { v: 'once' } }));
    api.on('GET', '/secret', () => ({ body: { v: 'fallback' } }));

    const unauthenticated = send('GET', '/secret');
    vi.advanceTimersByTime(0);
    expect((unauthenticated.getError() as HttpErrorResponse).status).toBe(401);

    const authenticated = send('GET', '/secret', null, { Authorization: `Bearer ${mintToken()}` });
    vi.advanceTimersByTime(0);

    expect((authenticated.events[0] as HttpResponse<unknown>).body).toEqual({ v: 'once' });
  });

  it('does not leave a request without a matching route counted as in flight', () => {
    const { getError } = send('GET', '/typo');

    expect(getError()).toBeInstanceOf(Error);
    expect(api.pending()).toHaveLength(0);
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

  it('records the outgoing request, including the options that only exist on the wire', () => {
    api.on('GET', '/wire', () => ({ body: { ok: true } }));

    send('GET', '/wire', null, {}, { withCredentials: true, responseType: 'text', reportProgress: true });
    vi.advanceTimersByTime(0);

    const [request] = api.httpRequests('GET', '/wire');

    expect(request).toBeInstanceOf(HttpRequest);
    expect(request?.withCredentials).toBe(true);
    expect(request?.responseType).toBe('text');
    expect(request?.reportProgress).toBe(true);
    expect(api.requests[0]?.request).toBe(request);
  });

  it('delivers scripted progress events over time, in both directions', () => {
    api.on('POST', '/upload', () => ({
      body: { ok: true },
      delay: 30,
      progressEvents: [
        { at: 10, direction: 'upload', loaded: 50, total: 100 },
        { at: 20, direction: 'download', loaded: 500, total: 1000 },
      ],
    }));

    const { events, isCompleted } = send('POST', '/upload', { name: 'a' }, {}, { reportProgress: true });

    vi.advanceTimersByTime(10);
    expect(events).toEqual([{ type: HttpEventType.UploadProgress, loaded: 50, total: 100 }]);

    vi.advanceTimersByTime(10);
    expect(events[1]).toEqual({ type: HttpEventType.DownloadProgress, loaded: 500, total: 1000 });
    expect(isCompleted()).toBe(false);

    vi.advanceTimersByTime(10);
    expect(isCompleted()).toBe(true);
    expect((events[2] as HttpResponse<unknown>).body).toEqual({ ok: true });
  });

  it('withholds scripted progress events from a request that did not ask for progress', () => {
    api.on('GET', '/quiet', () => ({
      body: { ok: true },
      delay: 30,
      progressEvents: [{ at: 10, loaded: 50 }],
    }));

    const { events } = send('GET', '/quiet');

    vi.advanceTimersByTime(30);

    expect(events).toHaveLength(1);
    expect((events[0] as HttpResponse<unknown>).body).toEqual({ ok: true });
  });

  it('still emits the progress percentages in the tick the response lands in', () => {
    api.on('GET', '/download', () => ({ body: 'ok', delay: 100, progress: [25, 100] }));

    const { events } = send('GET', '/download');

    vi.advanceTimersByTime(99);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(events.slice(0, 2)).toEqual([
      { type: HttpEventType.DownloadProgress, loaded: 25, total: 100 },
      { type: HttpEventType.DownloadProgress, loaded: 100, total: 100 },
    ]);
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

  describe('createFakeXhr', () => {
    const openXhr = (method: string, path: string, headers: Record<string, string> = {}) => {
      const XhrClass = createFakeXhr(api);
      const xhr = new XhrClass();

      xhr.open(method, `${BASE_URL}${path}`);
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);

      return xhr;
    };

    const record = (xhr: XMLHttpRequest) => {
      const events: string[] = [];

      for (const type of ['load', 'error', 'abort', 'progress']) {
        xhr.addEventListener(type, () => events.push(type));
      }

      return events;
    };

    it('routes a request through the fake api and reports it as loaded', () => {
      api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] } }));

      const xhr = openXhr('GET', '/users/1');
      const events = record(xhr);

      xhr.responseType = 'text';
      xhr.send(null);

      expect(events).toEqual([]);
      vi.advanceTimersByTime(0);

      expect(events).toEqual(['load']);
      expect(xhr.status).toBe(200);
      expect(xhr.readyState).toBe(xhr.DONE);
      expect(JSON.parse(xhr.responseText)).toEqual({ id: '1' });
      expect(xhr.responseURL).toBe(`${BASE_URL}/users/1`);
      expect(api.requestCount('GET', '/users/1')).toBe(1);
    });

    it('reports an error status as a load with that status', () => {
      api.on('GET', '/broken', () => ({ status: 500, body: { message: 'boom' } }));

      const xhr = openXhr('GET', '/broken');
      const events = record(xhr);

      xhr.send(null);
      vi.advanceTimersByTime(0);

      expect(events).toEqual(['load']);
      expect(xhr.status).toBe(500);
      expect(JSON.parse(xhr.responseText)).toEqual({ message: 'boom' });
    });

    it('reports a status 0 response as an error event', () => {
      api.on('GET', '/offline', () => ({ status: 0 }));

      const xhr = openXhr('GET', '/offline');
      const events = record(xhr);

      xhr.send(null);
      vi.advanceTimersByTime(0);

      expect(events).toEqual(['error']);
      expect(xhr.status).toBe(0);
    });

    it('marks the request log entry aborted when abort() runs before the response', () => {
      api.on('GET', '/slow', () => ({ body: [], delay: 500 }));

      const xhr = openXhr('GET', '/slow');
      const events = record(xhr);

      xhr.send(null);
      vi.advanceTimersByTime(100);
      expect(api.pending().length).toBe(1);

      xhr.abort();

      expect(events).toEqual(['abort']);
      expect(api.requests[0]?.aborted).toBe(true);
      expect(api.pending().length).toBe(0);

      vi.advanceTimersByTime(500);
      expect(events).toEqual(['abort']);
    });

    it('round-trips request and response headers', () => {
      api.on('GET', '/headers', ({ headers }) => ({
        body: { seen: headers.get('X-Client') },
        headers: { 'cache-control': 'max-age=60' },
      }));

      const xhr = openXhr('GET', '/headers', { 'X-Client': 'legacy' });

      xhr.send(null);
      vi.advanceTimersByTime(0);

      expect(JSON.parse(xhr.responseText)).toEqual({ seen: 'legacy' });
      expect(xhr.getResponseHeader('cache-control')).toBe('max-age=60');
      expect(xhr.getAllResponseHeaders()).toContain('cache-control: max-age=60');
    });

    it('passes a json request body to the handler as an object', () => {
      api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      const xhr = openXhr('POST', '/users', { 'Content-Type': 'application/json' });

      xhr.send(JSON.stringify({ name: 'Ada' }));
      vi.advanceTimersByTime(0);

      expect(api.requests[0]?.body).toEqual({ name: 'Ada' });
      expect(JSON.parse(xhr.responseText)).toEqual({ name: 'Ada' });
    });

    it('emits progress events for a handler that reports progress', () => {
      api.on('GET', '/download', () => ({ body: 'ok', progress: [25, 100] }));

      const xhr = openXhr('GET', '/download');
      const loaded: number[] = [];

      xhr.addEventListener('progress', (event) => loaded.push((event as ProgressEvent).loaded));
      xhr.send(null);
      vi.advanceTimersByTime(0);

      expect(loaded).toEqual([25, 100]);
      expect(xhr.status).toBe(200);
    });

    it('can be reopened and resent after it is done', () => {
      api.on('GET', '/retry', sequence([{ status: 503 }, { body: 'ok' }]));

      const xhr = openXhr('GET', '/retry');

      xhr.send(null);
      vi.advanceTimersByTime(0);
      expect(xhr.status).toBe(503);

      xhr.open('GET', `${BASE_URL}/retry`);
      xhr.send(null);
      vi.advanceTimersByTime(0);

      expect(xhr.status).toBe(200);
      expect(api.requestCount('GET', '/retry')).toBe(2);
    });
  });
});
