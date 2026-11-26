import { InputPrefixDirective } from '../../../../directives/input-prefix';
import { InputSuffixDirective } from '../../../../directives/input-suffix';
import { LabelComponent } from '../../../label/components/label';
import { SelectFieldComponent } from '../select-field';
import { SelectComponent } from './components/select';
import { SelectOptionComponent } from './partials/select-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SelectImports = [
  SelectComponent,
  SelectOptionComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
] as const;
