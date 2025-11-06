import { SortDirection } from '@ethlete/query';

export type SortHeaderArrowPosition = 'before' | 'after';

export interface Sortable {
  id: string;
  start: SortDirection;
  disableClear: boolean;
}

export interface SortDefaultOptions {
  disableClear?: boolean;
  arrowPosition?: SortHeaderArrowPosition;
}
