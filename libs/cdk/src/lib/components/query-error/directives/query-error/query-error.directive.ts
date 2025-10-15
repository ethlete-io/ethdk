import { Directive, InjectionToken, computed, input } from '@angular/core';
import {
  AnyQuery,
  AnyQueryCollection,
  ExperimentalQuery,
  RequestError,
  isClassValidatorError,
  isSymfonyFormViolationListError,
  isSymfonyListError,
  shouldRetryRequest,
} from '@ethlete/query';
import { QueryErrorList } from '../../types';

export const QUERY_ERROR_TOKEN = new InjectionToken<QueryErrorDirective>('QUERY_ERROR_DIRECTIVE_TOKEN');

@Directive({
  standalone: true,
  exportAs: 'etQueryError',
  providers: [
    {
      provide: QUERY_ERROR_TOKEN,
      useExisting: QueryErrorDirective,
    },
  ],
})
export class QueryErrorDirective {
  error = input.required<RequestError | null>();
  query = input.required<AnyQuery | ExperimentalQuery.AnyLegacyQuery | AnyQueryCollection | null>();
  language = input<'en' | 'de'>('en');

  readonly errorList = computed(() => {
    const error = this.error();

    if (!error) {
      return null;
    }

    const retryResult = shouldRetryRequest({ error, currentRetryCount: 0, headers: {} });

    const errorList: QueryErrorList = {
      canBeRetried: retryResult.retry,
      retryDelay: retryResult.delay ?? 0,
      isList: false,
      items: [],
      title:
        this.language() === 'en'
          ? ExperimentalQuery.parseHttpErrorCodeToTitleEn(error.status)
          : ExperimentalQuery.parseHttpErrorCodeToTitleDe(error.status),
    };

    const detail = error.detail;
    const defaultErrorMessage = `${this.language() === 'en' ? ExperimentalQuery.parseHttpErrorCodeToMessageEn(error.status) : ExperimentalQuery.parseHttpErrorCodeToMessageDe(error.status)} (Code: ${error.status})`;

    if (isClassValidatorError(detail)) {
      for (const error of detail.message) {
        errorList.items.push({ message: error });
      }
    } else if (isSymfonyFormViolationListError(detail)) {
      for (const violation of detail.violations) {
        errorList.items.push({ message: violation.message });
      }
    } else if (isSymfonyListError(detail)) {
      for (const error of detail) {
        errorList.items.push({ message: error.message });
      }
    } else if (typeof detail === 'object' && !!detail && 'message' in detail && typeof detail.message === 'string') {
      errorList.items.push({ message: detail.message });
    } else if (typeof detail === 'object' && !!detail && 'detail' in detail && typeof detail.detail === 'string') {
      // Symfony error response (during development)
      errorList.items.push({ message: detail.detail });
    } else if (typeof detail === 'string') {
      errorList.items.push({ message: detail });
    } else {
      errorList.items.push({ message: defaultErrorMessage });
    }

    errorList.isList = errorList.items.length > 1;

    if (errorList.items.length === 1) {
      const compareString = (str: string) => str.toLowerCase().replace(/\s/g, '').replace(/\.|,/g, '');

      if (compareString(errorList.items[0]!.message) === compareString(errorList.title)) {
        // Often the error title is the same as the error message. In this case we simply use the default error message as a message.
        // This way the same text is at least not displayed twice.
        errorList.items[0]!.message = defaultErrorMessage;
      }
    }

    return errorList;
  });
}
