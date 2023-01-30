import { SortHeaderComponent } from './components';
import { SortDirective } from './partials';
import { SORT_HEADER_INTL_PROVIDER } from './services';

export const SortImports = [SortDirective, SortHeaderComponent] as const;

export const provideSort = () => {
  return [SORT_HEADER_INTL_PROVIDER];
};
