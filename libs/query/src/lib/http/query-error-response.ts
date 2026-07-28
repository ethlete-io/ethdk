import { HttpErrorResponse } from '@angular/common/http';
import {
  isClassValidatorError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
} from './query-error-response-utils';
import { shouldRetryRequest, ShouldRetryRequestResult } from './query-retry-utils';

export type QueryErrorResponseList = {
  isList: true;
  errors: QueryErrorResponseItem[];
};

export type QueryErrorResponseSingle = {
  isList: false;
  error: QueryErrorResponseItem;
};

export type QueryErrorResponse = {
  raw: HttpErrorResponse;
  retryState: ShouldRetryRequestResult;
  code: number;
} & (QueryErrorResponseList | QueryErrorResponseSingle);

export type QueryErrorResponseItem = {
  message: string;
};

export const isQueryErrorResponse = (error: unknown): error is QueryErrorResponse => {
  return typeof error === 'object' && error !== null && 'raw' in error && 'retryState' in error && 'isList' in error;
};

/**
 * Every message carried by an error, flattened into a plain list — one entry for a single error,
 * one per violation for a list (a form response with several field violations), empty for `null`.
 *
 * The single/list split exists because that is how APIs answer; UI almost never wants to branch on
 * it. Reach for this when rendering, and keep {@link QueryErrorResponse} for anything that needs
 * the status code or the raw response.
 *
 * @example
 * ```html
 * @for (message of queryErrorMessages(myQuery.error()); track message) {
 *   <p class="error">{{ message }}</p>
 * }
 * ```
 */
export const queryErrorMessages = (error: QueryErrorResponse | null | undefined): string[] => {
  if (!error) return [];

  return error.isList ? error.errors.map((item) => item.message) : [error.error.message];
};

/**
 * The first message of an error, or `null` when there is none — the single-line counterpart to
 * {@link queryErrorMessages}, for a toast or a form-field hint.
 */
export const queryErrorMessage = (error: QueryErrorResponse | null | undefined): string | null =>
  queryErrorMessages(error)[0] ?? null;

export const createQueryErrorResponse = (error: unknown): QueryErrorResponse => {
  let err = error instanceof HttpErrorResponse ? error : null;

  if (!err) {
    err = new HttpErrorResponse({
      error: error,
      status: 0,
      statusText: 'Unknown Error',
    });
  }
  const retryState = shouldRetryRequest(err);

  const detail = err.error;
  const errorList: QueryErrorResponseItem[] = [];

  if (isClassValidatorError(detail)) {
    for (const error of detail.message) {
      errorList.push({ message: error });
    }
  } else if (isSymfonyFormViolationListError(detail)) {
    for (const violation of detail.violations) {
      errorList.push({ message: violation.message });
    }
  } else if (isSymfonyListError(detail)) {
    for (const error of detail) {
      errorList.push({ message: error.message });
    }
  } else if (typeof detail === 'object' && !!detail && 'message' in detail && typeof detail.message === 'string') {
    errorList.push({ message: detail.message });
  } else if (typeof detail === 'object' && !!detail && 'detail' in detail && typeof detail.detail === 'string') {
    // Symfony error response (during development)
    errorList.push({ message: detail.detail });
  } else if (typeof detail === 'string') {
    errorList.push({ message: detail });
  } else if (Array.isArray(detail) && detail.length > 0 && typeof detail[0] === 'string') {
    for (const error of detail) {
      errorList.push({ message: error });
    }
  }

  if (errorList.length > 1) {
    return {
      isList: true,
      errors: errorList,
      raw: err,
      retryState,
      code: err.status,
    };
  } else {
    const singleError = errorList[0] ?? { message: err.message };

    return {
      isList: false,
      error: singleError,
      raw: err,
      retryState,
      code: err.status,
    };
  }
};
