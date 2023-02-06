import { InputPrefixDirective, InputSuffixDirective } from '../../directives';
import { NativeSelectInputComponent, NativeSelectOptionComponent, SelectFieldComponent } from './components';
import { NativeSelectInputDirective, NativeSelectOptionDirective } from './directives';

export const NativeSelectImports = [
  NativeSelectInputComponent,
  NativeSelectOptionComponent,
  SelectFieldComponent,
  NativeSelectInputDirective,
  NativeSelectOptionDirective,
  InputPrefixDirective,
  InputSuffixDirective,
] as const;
