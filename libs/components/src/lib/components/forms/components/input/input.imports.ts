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
  TextareaInputComponent,
} from './components';
import { PasswordInputToggleComponent, SearchInputClearComponent } from './partials';

export const InputImports = [
  InputFieldComponent,
  NumberInputComponent,
  SearchInputComponent,
  PasswordInputComponent,
  PasswordInputToggleComponent,
  TextInputComponent,
  TextareaInputComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  IfInputFilledDirective,
  IfInputEmptyDirective,
  SearchInputClearComponent,
] as const;
