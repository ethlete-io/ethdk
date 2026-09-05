import { HttpErrorResponse } from '@angular/common/http';
import { ShouldRetryRequestFn, ShouldRetryRequestOptions, ShouldRetryRequestResult } from './query-retry-utils';

/**
 * Turns an error response body into the messages a UI should show, or `null` when the body is not
 * the shape this parser knows - in which case the next parser gets a turn, and the built-in
 * `string` / `{ message }` / `{ detail }` ladder after them.
 *
 * Returning an **empty array** means "this is my shape, but there is nothing readable in it": no
 * further parser runs and the `HttpErrorResponse`'s own message is used.
 *
 * @example
 * registerQueryErrorParser((detail) =>
 *   isObject(detail) && 'errorCode' in detail ? [translate(detail.errorCode)] : null,
 * );
 */
export type QueryErrorParser = (detail: unknown, response: HttpErrorResponse) => string[] | null;

const parsers: QueryErrorParser[] = [];

/**
 * Adds a parser to the pipeline `createQueryErrorResponse` runs, ahead of the built-in ladder.
 * Registering the same function twice is a no-op, and parsers run in registration order.
 *
 * The built-in ones are installed by the {@link withHtmlErrorParsing} / {@link withSymfonyErrors}
 * query client features - reach for this directly only for an API shape the SDK does not know.
 */
export const registerQueryErrorParser = (parser: QueryErrorParser) => {
  if (!parsers.includes(parser)) parsers.push(parser);
};

/** @internal */
export const runQueryErrorParsers = (detail: unknown, response: HttpErrorResponse) => {
  for (const parser of parsers) {
    const messages = parser(detail, response);

    if (messages) return messages;
  }

  return null;
};

const NO_RETRY: ShouldRetryRequestResult = { retry: false };

let defaultRetryFn: ShouldRetryRequestFn | null = null;

/** @internal */
export const setDefaultQueryRetryFn = (fn: ShouldRetryRequestFn) => {
  defaultRetryFn = fn;
};

/** @internal */
export const runDefaultQueryRetry = (options: ShouldRetryRequestOptions) => defaultRetryFn?.(options) ?? NO_RETRY;
