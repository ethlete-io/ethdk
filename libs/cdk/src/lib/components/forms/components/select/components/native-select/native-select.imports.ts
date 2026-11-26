import { InputPrefixDirective } from '../../../../directives/input-prefix';
import { InputSuffixDirective } from '../../../../directives/input-suffix';
import { LabelComponent } from '../../../label/components/label';
import { SelectFieldComponent } from '../select-field';
import { NativeSelectInputComponent } from './components/native-select';
import { NativeSelectInputDirective } from './directives/native-select-input';
import { NativeSelectOptionDirective } from './directives/native-select-option';
import { NativeSelectOptionComponent } from './partials/native-select-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const NativeSelectImports = [
  NativeSelectInputComponent,
  NativeSelectOptionComponent,
  SelectFieldComponent,
  NativeSelectInputDirective,
  NativeSelectOptionDirective,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
] as const;
