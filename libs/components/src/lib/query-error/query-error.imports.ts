import { QueryErrorActionsDirective, QueryErrorTitleDirective } from './headless/query-error-slots.directive';
import { QueryErrorDirective } from './headless/query-error.directive';
import { QueryErrorComponent } from './query-error.component';

export const QUERY_ERROR_IMPORTS = [
  QueryErrorComponent,
  QueryErrorDirective,
  QueryErrorTitleDirective,
  QueryErrorActionsDirective,
] as const;
