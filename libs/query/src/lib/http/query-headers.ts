import { HttpHeaders } from '@angular/common/http';

/** Request headers, either as Angular `HttpHeaders` or as a plain record of header names to values. */
export type QueryHeaders = HttpHeaders | Record<string, string | string[]>;

/** Request headers, or a function returning them that is called on every execution. */
export type QueryHeadersInput = QueryHeaders | (() => QueryHeaders);

/** Resolves a {@link QueryHeadersInput} to `HttpHeaders`, or `undefined` when none is given. */
export const resolveQueryHeaders = (input: QueryHeadersInput | undefined) => {
  const headers = typeof input === 'function' ? input() : input;

  if (!headers) return undefined;

  return headers instanceof HttpHeaders ? headers : new HttpHeaders(headers);
};
