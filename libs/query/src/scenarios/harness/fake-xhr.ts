import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Subscription } from 'rxjs';
import { FakeApi } from './fake-api';

type FakeXhrListener = (event: Event) => void;

const UNSENT = 0;
const OPENED = 1;
const HEADERS_RECEIVED = 2;
const LOADING = 3;
const DONE = 4;

class FakeXhrEventTarget {
  private readonly listeners = new Map<string, Set<FakeXhrListener>>();

  addEventListener(type: string, listener: FakeXhrListener) {
    const existing = this.listeners.get(type) ?? new Set<FakeXhrListener>();

    existing.add(listener);
    this.listeners.set(type, existing);
  }

  removeEventListener(type: string, listener: FakeXhrListener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: Event) {
    const handler = (this as unknown as Record<string, FakeXhrListener | undefined>)[`on${event.type}`];

    handler?.call(this, event);

    for (const listener of Array.from(this.listeners.get(event.type) ?? [])) listener.call(this, event);

    return true;
  }
}

const buildEvent = (type: string, target: unknown) =>
  ({ type, target, currentTarget: target, bubbles: false, cancelable: false }) as unknown as Event;

const buildProgressEvent = (type: string, target: unknown, loaded: number, total: number) =>
  ({
    type,
    target,
    currentTarget: target,
    loaded,
    total,
    lengthComputable: total > 0,
  }) as unknown as ProgressEvent;

const stringifyBody = (body: unknown) => {
  if (body === null || body === undefined) return '';
  if (typeof body === 'string') return body;

  return JSON.stringify(body);
};

/**
 * A minimal `XMLHttpRequest` that routes through a `FakeApi` instead of the network, so the legacy
 * (v2) query system - which talks to `XMLHttpRequest` directly - hits the same routes, request log
 * and abort tracking as the current system.
 */
export const createFakeXhr = (api: FakeApi): typeof XMLHttpRequest => {
  class FakeXhr extends FakeXhrEventTarget {
    static readonly UNSENT = UNSENT;
    static readonly OPENED = OPENED;
    static readonly HEADERS_RECEIVED = HEADERS_RECEIVED;
    static readonly LOADING = LOADING;
    static readonly DONE = DONE;

    readonly UNSENT = UNSENT;
    readonly OPENED = OPENED;
    readonly HEADERS_RECEIVED = HEADERS_RECEIVED;
    readonly LOADING = LOADING;
    readonly DONE = DONE;

    readonly upload = new FakeXhrEventTarget();

    readyState = UNSENT;
    status = 0;
    statusText = '';
    responseURL = '';
    responseType: XMLHttpRequestResponseType = '';
    withCredentials = false;
    timeout = 0;

    private method = 'GET';
    private url = '';
    private requestHeaders = new HttpHeaders();
    private responseHeaders = new HttpHeaders();
    private responseBody: unknown = null;
    private subscription: Subscription | null = null;

    get response(): unknown {
      if (this.responseType === 'json') return this.responseBody;

      return this.responseText;
    }

    get responseText() {
      return stringifyBody(this.responseBody);
    }

    open(method: string, url: string) {
      this.subscription?.unsubscribe();
      this.subscription = null;
      this.method = method.toUpperCase();
      this.url = url;
      this.requestHeaders = new HttpHeaders();
      this.responseHeaders = new HttpHeaders();
      this.responseBody = null;
      this.status = 0;
      this.statusText = '';
      this.responseURL = '';
      this.readyState = OPENED;
    }

    setRequestHeader(name: string, value: string) {
      this.requestHeaders = this.requestHeaders.append(name, value);
    }

    getAllResponseHeaders() {
      return this.responseHeaders
        .keys()
        .map((key) => `${key}: ${this.responseHeaders.getAll(key)?.join(', ') ?? ''}`)
        .join('\r\n');
    }

    getResponseHeader(name: string) {
      return this.responseHeaders.get(name);
    }

    send(body: unknown = null) {
      if (this.readyState !== OPENED) throw new Error('FakeXhr: send() was called before open()');

      const request = new HttpRequest(this.method, this.url, this.parseBody(body), { headers: this.requestHeaders });

      this.subscription = api.backend.handle(request).subscribe({
        next: (event) => this.onBackendEvent(event),
        error: (error: unknown) => this.onBackendError(error),
      });
    }

    abort() {
      this.subscription?.unsubscribe();
      this.subscription = null;

      if (this.readyState === UNSENT || this.readyState === DONE) return;

      this.readyState = DONE;
      this.status = 0;
      this.statusText = '';
      this.responseBody = null;
      this.dispatchEvent(buildEvent('abort', this));
    }

    private parseBody(body: unknown) {
      if (typeof body !== 'string') return body ?? null;

      const contentType = this.requestHeaders.get('Content-Type') ?? '';

      if (!contentType.includes('json')) return body;

      try {
        return JSON.parse(body) as unknown;
      } catch {
        return body;
      }
    }

    private onBackendEvent(event: HttpEvent<unknown>) {
      if (event.type === HttpEventType.DownloadProgress) {
        this.readyState = LOADING;
        this.dispatchEvent(buildProgressEvent('progress', this, event.loaded, event.total ?? 0));

        return;
      }

      if (!(event instanceof HttpResponse)) return;

      this.settle(event.status, event.statusText, event.headers, event.body, event.url);
      this.dispatchEvent(buildEvent('load', this));
    }

    private onBackendError(error: unknown) {
      if (!(error instanceof HttpErrorResponse)) throw error;

      this.settle(error.status, error.statusText, error.headers, error.error, error.url);
      this.dispatchEvent(buildEvent(error.status === 0 ? 'error' : 'load', this));
    }

    private settle(
      status: number,
      statusText: string,
      headers: HttpHeaders,
      body: unknown,
      url: string | null | undefined,
    ) {
      this.readyState = DONE;
      this.status = status;
      this.statusText = statusText;
      this.responseHeaders = headers;
      this.responseBody = body ?? null;
      this.responseURL = url ?? this.url;
    }
  }

  return FakeXhr as unknown as typeof XMLHttpRequest;
};
