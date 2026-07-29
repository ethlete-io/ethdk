import { InjectionToken } from '@angular/core';
import { QueryErrorDirective } from './query-error.directive';

export const QUERY_ERROR_TOKEN = new InjectionToken<QueryErrorDirective>('QUERY_ERROR_TOKEN');
