import { FormFieldComponent } from './form-field.component';
import { FormFieldDirective, LabelDirective } from './headless';
import { HintComponent } from './hint.component';
import { InputPrefixDirective, InputSuffixDirective } from './partials';

export const FORM_FIELD_IMPORTS = [
  FormFieldComponent,
  FormFieldDirective,
  LabelDirective,
  HintComponent,
  InputPrefixDirective,
  InputSuffixDirective,
] as const;
