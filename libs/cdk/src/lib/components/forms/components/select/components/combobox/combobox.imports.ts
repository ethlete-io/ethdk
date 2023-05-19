import { InputPrefixDirective, InputSuffixDirective } from '../../../../directives';
import { LabelComponent } from '../../../label';
import { SelectFieldComponent } from '../select-field';
import { ComboboxComponent } from './components';

export const ComboboxImports = [
  ComboboxComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
] as const;
