import { SortHeaderComponent } from './components/sort-header';
import { SortDirective } from './partials/sort';
import { SORT_HEADER_INTL_PROVIDER } from './services';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SortImports = [SortDirective, SortHeaderComponent] as const;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const provideSort = () => {
  return [SORT_HEADER_INTL_PROVIDER];
};
