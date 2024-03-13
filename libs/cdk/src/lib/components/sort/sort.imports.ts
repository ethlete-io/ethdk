import { SortHeaderComponent } from './components/sort-header';
import { SortDirective } from './partials/sort';
import { SORT_HEADER_INTL_PROVIDER } from './services';

export const SortImports = [SortDirective, SortHeaderComponent] as const;

export const provideSort = () => {
  return [SORT_HEADER_INTL_PROVIDER];
};
