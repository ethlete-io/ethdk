import { SortHeaderComponent } from './components';
import { SortDirective } from './partials';
import { SORT_HEADER_INTL_PROVIDER } from './services';

export const SortImports = [SortDirective, SortHeaderComponent] as const;

export const SortDefaultProviders = [SORT_HEADER_INTL_PROVIDER];
