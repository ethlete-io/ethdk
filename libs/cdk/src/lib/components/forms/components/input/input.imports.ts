import {
  IfInputEmptyDirective,
  IfInputFilledDirective,
  InputPrefixDirective,
  InputSuffixDirective,
} from '../../directives';
import { LabelComponent } from '../label';
import {
  DateInputComponent,
  DateTimeInputComponent,
  EmailInputComponent,
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
  EmailInputComponent,
  LabelComponent,
  DateInputComponent,
  DateTimeInputComponent,
] as const;
