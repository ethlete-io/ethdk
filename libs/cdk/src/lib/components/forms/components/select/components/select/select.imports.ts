import { InputPrefixDirective, InputSuffixDirective } from '../../../../directives';
import { LabelComponent } from '../../../label';
import { SelectFieldComponent } from '../select-field';
import { SelectComponent } from './components';
import { SelectOptionComponent, TreeSelectOptionComponent } from './partials';

export const SelectImports = [
  SelectComponent,
  SelectOptionComponent,
  TreeSelectOptionComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
] as const;
