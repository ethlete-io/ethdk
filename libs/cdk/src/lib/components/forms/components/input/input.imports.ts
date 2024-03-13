import { IfInputEmptyDirective } from '../../directives/if-input-empty';
import { IfInputFilledDirective } from '../../directives/if-input-filled';
import { InputPrefixDirective } from '../../directives/input-prefix';
import { InputSuffixDirective } from '../../directives/input-suffix';
import { LabelComponent } from '../label/components/label';
import { DateInputComponent } from './components/date-input';
import { DateTimeInputComponent } from './components/date-time-input';
import { EmailInputComponent } from './components/email-input';
import { InputFieldComponent } from './components/input-field';
import { NumberInputComponent } from './components/number-input';
import { PasswordInputComponent } from './components/password-input';
import { SearchInputComponent } from './components/search-input';
import { TextInputComponent } from './components/text-input';
import { TextareaInputComponent } from './components/textarea-input';
import { IfSupportsShowPickerDirective } from './directives/if-supports-show-picker';
import { ShowPickerTriggerDirective } from './directives/show-picker-trigger';
import { PasswordInputToggleComponent } from './partials/password-input-toggle';
import { SearchInputClearComponent } from './partials/search-input-clear';

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
  ShowPickerTriggerDirective,
  IfInputEmptyDirective,
  SearchInputClearComponent,
  EmailInputComponent,
  LabelComponent,
  DateInputComponent,
  DateTimeInputComponent,
  IfSupportsShowPickerDirective,
] as const;
