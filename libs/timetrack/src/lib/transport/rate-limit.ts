import { MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';

export type RateLimitRetryOptions = {
  /** Retries after the first attempt. */
  retries: number;
  /** The wait before the first retry when the response named none. Doubles on each further retry. */
  baseDelayMs: number;
  /** The longest wait, whatever `Retry-After` asked for. */
  maxDelayMs: number;
};

export const DEFAULT_RATE_LIMIT_RETRY_OPTIONS: RateLimitRetryOptions = {
  retries: 2,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
};

/** The wait a `Retry-After` header asks for, as delta-seconds or as an HTTP date. */
export const retryAfterMsOf = (value: string | undefined, now = Date.now()): number | undefined => {
  const trimmed = value?.trim();

  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;

  const at = Date.parse(trimmed);

  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
};

/** A response header by name, whatever case the host spelled it in. */
export const responseHeaderOf = (headers: Record<string, string>, name: string) =>
  Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];

/**
 * Retries the source with backoff while `rateLimited` recognises its error, and rethrows every other
 * error at once. `rateLimited` answers the wait the response asked for, `null` for an error that is not
 * a rate limit, or `undefined` for a rate limit that named no wait.
 */
export const retryWhenRateLimited = <T>(
  rateLimited: (error: unknown) => { retryAfterMs?: number } | null,
  options: Partial<RateLimitRetryOptions> = {},
): MonoTypeOperatorFunction<T> => {
  const { retries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RATE_LIMIT_RETRY_OPTIONS, ...options };

  return retry({
    count: retries,
    delay: (error: unknown, retryCount) => {
      const limit = rateLimited(error);

      if (!limit) return throwError(() => error);

      return timer(Math.min(maxDelayMs, limit.retryAfterMs ?? baseDelayMs * 2 ** (retryCount - 1)));
    },
  });
};
