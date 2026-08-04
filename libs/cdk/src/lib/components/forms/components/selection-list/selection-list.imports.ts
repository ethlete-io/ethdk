import { SelectionListFieldComponent } from './components/selection-list-field';
import { SelectionListOptionComponent } from './components/selection-list-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SelectionListImports = [SelectionListFieldComponent, SelectionListOptionComponent] as const;
