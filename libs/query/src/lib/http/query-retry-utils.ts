import { HttpErrorResponse } from '@angular/common/http';
import { clamp } from '@ethlete/core';
import { isSymfonyPagerfantaOutOfRangeError } from './query-error-response-utils';

export type ShouldRetryRequestOptions = {
  retryCount: number;
  error: HttpErrorResponse;
};

export type ShouldRetryRequestResult =
  | {
      retry: false;
    }
  | {
      retry: true;
      delay: number;
    };

export type ShouldRetryRequestFn = (options: ShouldRetryRequestOptions) => ShouldRetryRequestResult;

/** @see createDefaultRetryFn */
export type DefaultRetryOptions = {
  /**
   * How many times a failed request is retried before its error is handed to the caller.
   *
   * `0` retries indefinitely, which is only ever right for a request nothing renders: a query that
   * never stops retrying never resolves to an error, so it stays `loading()` for as long as the
   * server stays down and the UI has nothing to show but a spinner.
   *
   * @default 3
   */
  maxAttempts?: number;

  /** The delay doubles per retry, starting at twice this. @default 1000 */
  baseDelayMs?: number;

  /** Upper bound of every delay, including one a `retry-after` header asked for. @default 30000 */
  maxDelayMs?: number;

  /**
   * How far the delay is spread randomly around its computed value, as a fraction of it: `0.25` picks
   * a delay between 0.75x and 1.25x. Keeps the tabs that failed together from retrying together.
   * `0` makes the backoff exact. A delay a `retry-after` header named is never jittered.
   *
   * @default 0.25
   */
  jitter?: number;

  /**
   * Which response statuses are worth retrying, replacing the defaults rather than adding to them.
   * A connection failure is status `0`.
   *
   * @default a connection failure (`0`), `408`, `425`, `429`, and every 5xx above `500`
   */
  retryableStatusCodes?: number[];
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30_000;
const DEFAULT_JITTER = 0.25;

// 500 is left out on purpose: an internal server error is a bug in the backend far more often than a
// blip, and repeating the request that triggered it does not make it go away.
const isRetryableByDefault = (status: number) =>
  status === 0 || status === 408 || status === 425 || status === 429 || status >= 501;

/**
 * Builds a retry policy: an exponentially backing off, jittered {@link ShouldRetryRequestFn} bounded by
 * an attempt ceiling. What {@link withDefaultRetry} installs - reach for this directly to hand a single
 * client or creator its own `retryFn`.
 *
 * @example
 * const flakyEndpointRetry = createDefaultRetryFn({ maxAttempts: 8, maxDelayMs: 10_000 });
 *
 * const getReport = myApiGet<GetReportArgs>('/report').clone({ retryFn: flakyEndpointRetry });
 */
export const createDefaultRetryFn = (options: DefaultRetryOptions = {}): ShouldRetryRequestFn => {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const jitter = clamp(options.jitter ?? DEFAULT_JITTER, 0, 1);
  const retryableStatusCodes = options.retryableStatusCodes;

  const isRetryableStatus = (status: number) =>
    retryableStatusCodes ? retryableStatusCodes.includes(status) : isRetryableByDefault(status);

  const backoff = (retryCount: number) => {
    const exponential = baseDelayMs * Math.pow(2, retryCount);
    const spread = jitter === 0 ? 1 : 1 + (Math.random() * 2 - 1) * jitter;

    return Math.round(clamp(exponential * spread, 0, maxDelayMs));
  };

  return ({ retryCount, error }) => {
    // Not an HTTP failure at all, so nothing about it says a second attempt would go any better.
    if (!(error instanceof HttpErrorResponse)) return { retry: false };

    if (maxAttempts > 0 && retryCount > maxAttempts) return { retry: false };

    const { status, error: detail, headers } = error;

    if (!isRetryableStatus(status)) return { retry: false };

    // A page past the end of a Pagerfanta collection answers 5xx, and asking for it again keeps
    // answering 5xx - the request is wrong, not the server.
    if (status >= 501 && isSymfonyPagerfantaOutOfRangeError(detail)) return { retry: false };

    if (status === 429) {
      const retryAfter = headers.get('retry-after') || headers.get('x-retry-after');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : NaN;

      // The server named a time, so it is used as named rather than jittered - only capped, since a
      // `retry-after` of an hour would otherwise arm a timer nobody is still around for.
      if (!Number.isNaN(delay)) return { retry: true, delay: Math.min(delay, maxDelayMs) };
    }

    return { retry: true, delay: backoff(retryCount) };
  };
};

const defaultRetryFn = /* @__PURE__ */ createDefaultRetryFn();

/**
 * The SDK's default retry policy, installed by {@link withDefaultRetry}: three retries with an
 * exponentially backing off, jittered delay, for a connection failure, a `408`, a `425`, a `429`
 * (honouring `retry-after`) and a 5xx above `500`.
 *
 * Pass {@link createDefaultRetryFn} options to {@link withDefaultRetry} to configure it.
 */
export const shouldRetryRequest = (options: ShouldRetryRequestOptions | HttpErrorResponse): ShouldRetryRequestResult =>
  defaultRetryFn(options instanceof HttpErrorResponse ? { retryCount: 0, error: options } : options);
