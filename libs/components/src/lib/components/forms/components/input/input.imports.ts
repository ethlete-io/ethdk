import { InputPrefixDirective, InputSuffixDirective } from '../../directives';
import { InputFieldComponent, NumberInputComponent, PasswordInputComponent, TextInputComponent } from './components';
import { PasswordInputToggleComponent } from './partials';

export const InputImports = [
  InputFieldComponent,
  NumberInputComponent,
  PasswordInputComponent,
  PasswordInputToggleComponent,
  TextInputComponent,
  InputPrefixDirective,
  InputSuffixDirective,
] as const;
