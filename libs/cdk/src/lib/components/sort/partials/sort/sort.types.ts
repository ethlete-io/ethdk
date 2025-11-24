import { SortDirection } from '@ethlete/query';

export type SortHeaderArrowPosition = 'before' | 'after';

export type Sortable = {
  id: string;
  start: SortDirection;
  disableClear: boolean;
};

export type SortDefaultOptions = {
  disableClear?: boolean;
  arrowPosition?: SortHeaderArrowPosition;
};
