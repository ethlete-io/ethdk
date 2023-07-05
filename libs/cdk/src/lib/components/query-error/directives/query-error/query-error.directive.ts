import { Directive, InjectionToken, Input, computed, signal } from '@angular/core';
import {
  AnyQuery,
  AnyQueryCollection,
  RequestError,
  isClassValidatorError,
  isSymfonyFormViolationListError,
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
  @Input({ required: true })
  get error(): RequestError | null {
    return this._error();
  }
  set error(value: RequestError) {
    this._error.set(value);
  }
  private readonly _error = signal<RequestError | null>(null);

  @Input({ required: true })
  query: AnyQuery | AnyQueryCollection | null = null;

  readonly errorList = computed(() => {
    if (!this.error) {
      return null;
    }

    const retryResult = shouldRetryRequest({ error: this.error, currentRetryCount: 0, headers: {} });

    const errorList: QueryErrorList = {
      canBeRetried: retryResult.retry,
      retryDelay: retryResult.delay ?? 0,
      isList: false,
      items: [],
      title: this.error.statusText,
    };

    const detail = this.error.detail;
    const defaultErrorMessage = `Something went wrong (Code: ${this.error.status})`;

    if (isClassValidatorError(detail)) {
      for (const error of detail.message) {
        errorList.items.push({ message: error });
      }
    } else if (isSymfonyFormViolationListError(detail)) {
      for (const violation of detail.violations) {
        errorList.items.push({ message: violation.message });
      }
    } else if (typeof detail === 'object' && !!detail && 'message' in detail && typeof detail.message === 'string') {
      errorList.items.push({ message: detail.message });
    } else {
      errorList.items.push({ message: defaultErrorMessage });
    }

    errorList.isList = errorList.items.length > 1;

    return errorList;
  });
}
