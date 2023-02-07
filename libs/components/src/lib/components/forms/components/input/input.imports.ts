import {
  IfInputEmptyDirective,
  IfInputFilledDirective,
  InputPrefixDirective,
  InputSuffixDirective,
} from '../../directives';
import {
  InputFieldComponent,
  NumberInputComponent,
  PasswordInputComponent,
  SearchInputComponent,
  TextInputComponent,
} from './components';
import { PasswordInputToggleComponent, SearchInputClearComponent } from './partials';

export const InputImports = [
  InputFieldComponent,
  NumberInputComponent,
  SearchInputComponent,
  PasswordInputComponent,
  PasswordInputToggleComponent,
  TextInputComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  IfInputFilledDirective,
  IfInputEmptyDirective,
  SearchInputClearComponent,
] as const;
