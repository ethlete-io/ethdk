import { InputPrefixDirective } from '../../../../directives/input-prefix';
import { InputSuffixDirective } from '../../../../directives/input-suffix';
import { LabelComponent } from '../../../label/components/label';
import { SelectFieldComponent } from '../select-field';
import { NativeSelectInputComponent } from './components/native-select';
import { NativeSelectInputDirective } from './directives/native-select-input';
import { NativeSelectOptionDirective } from './directives/native-select-option';
import { NativeSelectOptionComponent } from './partials/native-select-option';

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
