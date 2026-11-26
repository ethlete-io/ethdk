import { extractHtmlErrorMessage, htmlErrorPayload } from './query-error-html-utils';
import { QueryErrorParser } from './query-error-parsing';
import {
  isClassValidatorError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
} from './query-error-response-utils';

/**
 * Recovers the sentence inside an HTML error page (a proxy's 502, a maintenance page) and drops the
 * markup. Installed by {@link withHtmlErrorParsing}.
 *
 * A page with no readable text parses to no messages at all, which leaves the `HttpErrorResponse`'s
 * own message in place - still better than a wall of tags.
 */
export const htmlQueryErrorParser: QueryErrorParser = (detail) => {
  const html = htmlErrorPayload(detail);

  if (!html) return null;

  const message = extractHtmlErrorMessage(html);

  return message ? [message] : [];
};

/**
 * Reads the error shapes a Symfony/API-Platform backend and a NestJS class-validator pipeline answer
 * with: a form violation list, a bare violation array, and `{ message: string[] }`. Installed by
 * {@link withSymfonyErrors}.
 */
export const symfonyQueryErrorParser: QueryErrorParser = (detail) => {
  if (isClassValidatorError(detail)) return [...detail.message];
  if (isSymfonyFormViolationListError(detail)) return detail.violations.map((violation) => violation.message);
  if (isSymfonyListError(detail)) return detail.map((error) => error.message);

  return null;
};
