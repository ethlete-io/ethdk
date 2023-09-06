import { InputPrefixDirective, InputSuffixDirective } from '../../../../directives';
import { LabelComponent } from '../../../label';
import { SelectFieldComponent } from '../select-field';
import { ComboboxComponent } from './components';
import {
  ComboboxBodyEmptyTemplateDirective,
  ComboboxBodyErrorTemplateDirective,
  ComboboxBodyLoadingTemplateDirective,
  ComboboxOptionTemplateDirective,
  ComboboxSelectedOptionTemplateDirective,
} from './directives';

export const ComboboxImports = [
  ComboboxComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
  ComboboxOptionTemplateDirective,
  ComboboxSelectedOptionTemplateDirective,
  ComboboxBodyErrorTemplateDirective,
  ComboboxBodyLoadingTemplateDirective,
  ComboboxBodyEmptyTemplateDirective,
] as const;
