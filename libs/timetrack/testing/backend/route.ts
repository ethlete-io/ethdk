import { TimetrackRequestMethod } from '@ethlete/timetrack';

/** One request, already split. `path` has no host and no query string. */
export type FakeRoutedRequest = {
  method: TimetrackRequestMethod;
  path: string;
  query: URLSearchParams;
  body: unknown;
};

export type FakeAnswer = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

export const ok = (body: unknown): FakeAnswer => ({ status: 200, body });

export const created = (body: unknown): FakeAnswer => ({ status: 201, body });

export const noContent = (): FakeAnswer => ({ status: 204, body: null });

/**
 * A route the fake does not know. It answers 404 rather than an empty body on purpose: an empty body
 * lets a flow report success while doing nothing, which is the failure this backend exists to stop.
 */
export const notFound = (request: FakeRoutedRequest): FakeAnswer => ({
  status: 404,
  body: { errorMessages: [`The e2e fake backend has no route for ${request.method} ${request.path}.`] },
});

/** Reads a body the app sent as JSON, without asserting its shape. */
export const bodyOf = (request: FakeRoutedRequest): Record<string, unknown> =>
  typeof request.body === 'object' && request.body !== null ? (request.body as Record<string, unknown>) : {};

export const nestedOf = (holder: Record<string, unknown>, key: string): Record<string, unknown> => {
  const value = holder[key];

  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
};

export const stringOf = (holder: Record<string, unknown>, key: string): string | undefined => {
  const value = holder[key];

  return typeof value === 'string' ? value : undefined;
};
