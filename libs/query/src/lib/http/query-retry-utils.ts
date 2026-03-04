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

export const shouldRetryRequest = (
  options: ShouldRetryRequestOptions | HttpErrorResponse,
): ShouldRetryRequestResult => {
  const normalizedOptions =
    options instanceof HttpErrorResponse ? { retryCount: 0, error: options } : (options as ShouldRetryRequestOptions);
  const { retryCount, error } = normalizedOptions;
  const defaultRetryDelay = clamp(1000 + 1000 * retryCount, 1000, 5000);
  const { status, error: detail, headers } = error;

  // Code 0 usually means the internet connection is down. We retry in this case.
  // It could also be a CORS issue but that should not be the case in production.
  // We will retry in this case until the connection is back.
  if (status === 0) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Don't retry if we already retried 3 times
  if (retryCount > 3) {
    return { retry: false };
  }

  // Don't retry if it's not an http error
  if (!(error instanceof HttpErrorResponse)) {
    return { retry: false };
  }

  // Retry on 5xx errors (except 500 internal server error since those are usually not recoverable)
  if (status >= 501) {
    // Don't retry if a requested page is out of range
    if (isSymfonyPagerfantaOutOfRangeError(detail)) {
      return { retry: false };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 408 or 425 errors
  if (status === 408 || status === 425) {
    return { retry: true, delay: defaultRetryDelay };
  }

  // Retry on 429 errors
  if (status === 429) {
    const retryAfter = headers.get('retry-after') || headers.get('x-retry-after');

    if (retryAfter) {
      const delay = parseInt(retryAfter) * 1000;
      return { retry: true, delay: Number.isNaN(delay) ? defaultRetryDelay : delay };
    }

    return { retry: true, delay: defaultRetryDelay };
  }

  return { retry: false };
};
