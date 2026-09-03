import {
  HttpBackend,
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpHeaders,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { decodeToken } from './tokens';

export type FakeApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type FakeApiRequestContext = {
  params: Record<string, string>;
  query: Record<string, string>;
  headers: HttpHeaders;
  body: unknown;
};

export type FakeApiResponse = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  delay?: number;
  progress?: number[];
};

export type FakeApiHandlerFn = (ctx: FakeApiRequestContext) => FakeApiResponse;

export type FakeApiGuardFn = (token: { claims: Record<string, unknown> }) => boolean;

export type FakeApiRequestLogEntry = {
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: HttpHeaders;
  body: unknown;
  at: number;
  status: number | null;
  aborted: boolean;
};

export type CreateFakeApiConfig = {
  baseUrl: string;
};

export type FakeApi = {
  backend: HttpBackend;
  on: (method: FakeApiMethod, pattern: string, handler: FakeApiHandlerFn) => void;
  once: (method: FakeApiMethod, pattern: string, handler: FakeApiHandlerFn) => void;
  protect: (pattern: string, guard?: FakeApiGuardFn) => void;
  requests: FakeApiRequestLogEntry[];
  requestCount: (method: FakeApiMethod, path: string) => number;
  pending: () => FakeApiRequestLogEntry[];
  reset: () => void;
};

/** A handler that answers a route with the next response in `responses`, holding on the last one once exhausted. */
export const sequence = (responses: FakeApiResponse[]): FakeApiHandlerFn => {
  if (responses.length === 0) throw new Error('sequence(): at least one response is required');

  let index = 0;

  return () => {
    const response = responses[Math.min(index, responses.length - 1)] as FakeApiResponse;
    index++;

    return response;
  };
};

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

const matchSegments = (patternSegments: string[], pathSegments: string[]): Record<string, string> | null => {
  const params: Record<string, string> = {};

  for (let i = 0; i < patternSegments.length; i++) {
    const segment = patternSegments[i] as string;

    if (segment === '**') return params;
    if (i >= pathSegments.length) return null;

    const pathSegment = pathSegments[i] as string;

    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(pathSegment);
    } else if (segment !== '*' && segment !== pathSegment) {
      return null;
    }
  }

  return patternSegments.length === pathSegments.length ? params : null;
};

const splitUrl = (url: string, baseUrl: string) => {
  const withoutBase = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;
  const [pathPart, queryPart] = withoutBase.split('?');
  const path = pathPart || '/';
  const query: Record<string, string> = {};

  if (queryPart) {
    for (const [key, value] of new URLSearchParams(queryPart)) query[key] = value;
  }

  return { path, query };
};

const describeRoutes = (routes: { method: FakeApiMethod; pattern: string }[]) =>
  routes.map((r) => `${r.method} ${r.pattern}`).join('\n') || '(none registered)';

type RouteEntry = {
  method: FakeApiMethod;
  pattern: string;
  segments: string[];
  handler: FakeApiHandlerFn;
};

type ProtectRule = {
  segments: string[];
  guard?: FakeApiGuardFn;
};

export const createFakeApi = (config: CreateFakeApiConfig): FakeApi => {
  const routes: RouteEntry[] = [];
  const onceRoutes: RouteEntry[] = [];
  const protectRules: ProtectRule[] = [];
  const requests: FakeApiRequestLogEntry[] = [];

  const findMatch = (method: FakeApiMethod, pathSegments: string[]) => {
    for (let i = 0; i < onceRoutes.length; i++) {
      const route = onceRoutes[i] as RouteEntry;

      if (route.method !== method) continue;

      const params = matchSegments(route.segments, pathSegments);

      if (params) {
        onceRoutes.splice(i, 1);

        return { route, params };
      }
    }

    for (const route of routes) {
      if (route.method !== method) continue;

      const params = matchSegments(route.segments, pathSegments);

      if (params) return { route, params };
    }

    return null;
  };

  const checkProtection = (pathSegments: string[], headers: HttpHeaders): FakeApiResponse | null => {
    const applicable = protectRules.filter((rule) => matchSegments(rule.segments, pathSegments) !== null);

    if (applicable.length === 0) return null;

    const authHeader = headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

    if (!token) return { status: 401, body: { message: 'unauthorized' } };

    const claims = decodeToken(token);

    if (!claims) return { status: 401, body: { message: 'unauthorized' } };
    if (typeof claims['exp'] === 'number' && claims['exp'] * 1000 < Date.now()) {
      return { status: 401, body: { message: 'unauthorized' } };
    }

    for (const rule of applicable) {
      if (rule.guard && !rule.guard({ claims })) return { status: 401, body: { message: 'unauthorized' } };
    }

    return null;
  };

  const handle = (req: Parameters<HttpBackend['handle']>[0]): Observable<HttpEvent<unknown>> =>
    new Observable<HttpEvent<unknown>>((subscriber) => {
      const method = req.method as FakeApiMethod;
      const { path, query } = splitUrl(req.urlWithParams, config.baseUrl);
      const pathSegments = segmentsOf(path);

      const logEntry: FakeApiRequestLogEntry = {
        method,
        url: req.urlWithParams,
        path,
        params: {},
        query,
        headers: req.headers,
        body: req.body,
        at: Date.now(),
        status: null,
        aborted: false,
      };

      requests.push(logEntry);

      const match = findMatch(method, pathSegments);

      if (!match) {
        throw new Error(
          `FakeApi: no route matches ${method} ${path}. Registered routes:\n${describeRoutes([...routes, ...onceRoutes])}`,
        );
      }

      logEntry.params = match.params;

      const protection = checkProtection(pathSegments, req.headers);
      let response: FakeApiResponse;
      let thrown: HttpErrorResponse | null = null;

      if (protection) {
        response = protection;
      } else {
        try {
          response = match.route.handler({ params: match.params, query, headers: req.headers, body: req.body });
        } catch (e) {
          if (e instanceof HttpErrorResponse) {
            thrown = e;
            response = { status: e.status, body: e.error };
          } else {
            throw e;
          }
        }
      }

      const delay = response.delay ?? 0;
      let settled = false;

      const timer = setTimeout(() => {
        settled = true;
        logEntry.status = thrown?.status ?? response.status ?? 200;

        for (const percentage of response.progress ?? []) {
          subscriber.next({
            type: HttpEventType.DownloadProgress,
            loaded: percentage,
            total: 100,
          });
        }

        if (logEntry.status >= 400) {
          subscriber.error(
            thrown ??
              new HttpErrorResponse({
                status: logEntry.status,
                statusText: 'Fake API Error',
                url: req.urlWithParams,
                error: response.body,
                headers: new HttpHeaders(response.headers),
              }),
          );

          return;
        }

        subscriber.next(
          new HttpResponse({
            status: logEntry.status,
            statusText: 'OK',
            url: req.urlWithParams,
            body: response.body ?? null,
            headers: new HttpHeaders(response.headers),
          }),
        );
        subscriber.complete();
      }, delay);

      return () => {
        clearTimeout(timer);
        if (!settled) logEntry.aborted = true;
      };
    });

  return {
    backend: { handle } as HttpBackend,
    on: (method, pattern, handler) => {
      routes.push({ method, pattern, segments: segmentsOf(pattern), handler });
    },
    once: (method, pattern, handler) => {
      onceRoutes.push({ method, pattern, segments: segmentsOf(pattern), handler });
    },
    protect: (pattern, guard) => {
      protectRules.push({ segments: segmentsOf(pattern), guard });
    },
    requests,
    requestCount: (method, path) => requests.filter((r) => r.method === method && r.path === path).length,
    pending: () => requests.filter((r) => r.status === null && !r.aborted),
    reset: () => {
      routes.length = 0;
      onceRoutes.length = 0;
      protectRules.length = 0;
      requests.length = 0;
    },
  };
};
