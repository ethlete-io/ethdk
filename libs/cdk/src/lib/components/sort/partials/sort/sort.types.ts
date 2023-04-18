import { SortDirection } from '../../types';

export type SortHeaderArrowPosition = 'before' | 'after';

export interface Sortable {
  id: string;
  start: SortDirection;
  disableClear: boolean;
}

export interface Sort {
  active: string;
  direction: SortDirection;
}

export interface SortDefaultOptions {
  disableClear?: boolean;
  arrowPosition?: SortHeaderArrowPosition;
}
