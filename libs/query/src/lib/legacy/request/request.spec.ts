import { request } from './request';
import { RequestEvent, RequestRetryFnConfig } from './request.types';

type Reply = { status: number; body?: unknown; headers?: string };

class FakeXhr extends EventTarget {
  static instances: FakeXhr[] = [];

  readonly DONE = 4;
  readyState = 0;
  status = 0;
  statusText = '';
  response: unknown = undefined;
  responseText = '';
  responseType = '';
  responseURL = '';
  withCredentials = false;
  upload = new EventTarget();
  requestHeaders: Record<string, string> = {};
  sentBodies: unknown[] = [];
  aborted = false;
  private responseHeaders = '';

  constructor() {
    super();
    FakeXhr.instances.push(this);
  }

  open() {
    this.readyState = 1;
  }

  setRequestHeader(name: string, value: string) {
    this.requestHeaders[name] = value;
  }

  send(body: unknown) {
    this.sentBodies.push(body);
  }

  abort() {
    this.aborted = true;
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  getResponseHeader() {
    return null;
  }

  reply({ status, body, headers = '' }: Reply) {
    this.readyState = this.DONE;
    this.status = status;
    this.response = body;
    this.responseHeaders = headers;
    this.dispatchEvent(new Event('load'));
  }
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('legacy request', () => {
  const originalXhr = globalThis.XMLHttpRequest;

  beforeEach(() => {
    FakeXhr.instances = [];
    globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    globalThis.XMLHttpRequest = originalXhr;
    vi.useRealTimers();
  });

  const collect = <T>(events: RequestEvent<T>[]) => ({ next: (e: RequestEvent<T>) => events.push(e) });

  it('strips the XSSI prefix from a JSON body', async () => {
    const events: RequestEvent<{ a: number }>[] = [];
    request<{ a: number }>({ method: 'GET', urlWithParams: '/x' }).subscribe(collect(events));

    FakeXhr.instances[0]!.reply({ status: 200, body: ')]}\',\n{"a":1}' });
    await flush();

    expect(events.at(-1)).toMatchObject({ type: 'success', response: { a: 1 } });
  });

  it('treats a 204 as a success without a body', async () => {
    const events: RequestEvent[] = [];
    request({ method: 'DELETE', urlWithParams: '/x' }).subscribe(collect(events));

    FakeXhr.instances[0]!.reply({ status: 204, body: 'ignored' });
    await flush();

    expect(events.at(-1)).toMatchObject({ type: 'success', response: null });
  });

  it('reads a JSON Blob error body', async () => {
    const events: RequestEvent[] = [];
    request({
      method: 'GET',
      urlWithParams: '/x',
      responseType: 'blob',
      retryFn: () => ({ retry: false }),
    }).subscribe(collect(events));

    FakeXhr.instances[0]!.reply({
      status: 400,
      body: new Blob(['{"message":"bad"}'], { type: 'application/json' }),
    });
    await vi.waitFor(() => expect(events.at(-1)?.type).toBe('failure'));

    expect(events.at(-1)).toMatchObject({ type: 'failure', error: { detail: { message: 'bad' } } });
  });

  it('sends a URLSearchParams body form-encoded', () => {
    const body = new URLSearchParams('a=1');
    request({ method: 'POST', urlWithParams: '/x', body }).subscribe();

    const xhr = FakeXhr.instances[0]!;

    expect(xhr.requestHeaders['Content-Type']).toBe('application/x-www-form-urlencoded;charset=UTF-8');
    expect(xhr.sentBodies[0]).toBe(body);
  });

  it('retries and then succeeds', async () => {
    vi.useFakeTimers();
    const events: RequestEvent[] = [];
    request({
      method: 'GET',
      urlWithParams: '/x',
      retryFn: () => ({ retry: true, delay: 10 }),
    }).subscribe(collect(events));

    const xhr = FakeXhr.instances[0]!;
    xhr.reply({ status: 500, body: '' });
    await vi.advanceTimersByTimeAsync(10);
    xhr.reply({ status: 200, body: '{"ok":true}' });
    await vi.advanceTimersByTimeAsync(0);

    expect(events.map((e) => e.type)).toEqual(['start', 'delay-retry', 'start', 'success']);
    expect(xhr.sentBodies).toHaveLength(2);
  });

  it('aborts the request and clears the retry timer on unsubscribe', async () => {
    vi.useFakeTimers();
    const events: RequestEvent[] = [];
    const sub = request({
      method: 'GET',
      urlWithParams: '/x',
      retryFn: () => ({ retry: true, delay: 10 }),
    }).subscribe(collect(events));

    const xhr = FakeXhr.instances[0]!;
    xhr.reply({ status: 500, body: '' });
    await vi.advanceTimersByTimeAsync(0);
    xhr.readyState = 1;
    sub.unsubscribe();
    await vi.advanceTimersByTimeAsync(50);

    expect(xhr.aborted).toBe(true);
    expect(xhr.sentBodies).toHaveLength(1);
  });

  it('starts every subscription at retry count zero', async () => {
    vi.useFakeTimers();
    const counts: number[] = [];
    const req$ = request({
      method: 'GET',
      urlWithParams: '/x',
      retryFn: (config: RequestRetryFnConfig) => {
        counts.push(config.currentRetryCount);

        return { retry: true, delay: 10 };
      },
    });

    req$.subscribe();
    const first = FakeXhr.instances[0]!;
    first.reply({ status: 500, body: '' });
    await vi.advanceTimersByTimeAsync(10);
    first.reply({ status: 500, body: '' });
    await vi.advanceTimersByTimeAsync(10);

    req$.subscribe();
    FakeXhr.instances[1]!.reply({ status: 500, body: '' });
    await vi.advanceTimersByTimeAsync(0);

    expect(counts).toEqual([1, 2, 1]);
  });
});
