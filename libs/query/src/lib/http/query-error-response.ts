import { HttpErrorResponse } from '@angular/common/http';
import {
  isClassValidatorError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
} from './query-error-response-utils';
import { shouldRetryRequest, ShouldRetryRequestResult } from './query-utils';

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
