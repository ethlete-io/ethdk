import { InputPrefixDirective, InputSuffixDirective } from '../../../../directives';
import { LabelComponent } from '../../../label';
import { SelectFieldComponent } from '../select-field';
import { NativeSelectInputComponent } from './components';
import { NativeSelectInputDirective, NativeSelectOptionDirective } from './directives';
import { NativeSelectOptionComponent } from './partials';

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
