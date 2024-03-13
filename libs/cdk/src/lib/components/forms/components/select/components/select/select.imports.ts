import { InputPrefixDirective } from '../../../../directives/input-prefix';
import { InputSuffixDirective } from '../../../../directives/input-suffix';
import { LabelComponent } from '../../../label/components/label';
import { SelectFieldComponent } from '../select-field';
import { SelectComponent } from './components/select';
import { SelectOptionComponent } from './partials/select-option';

export const SelectImports = [
  SelectComponent,
  SelectOptionComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
] as const;
