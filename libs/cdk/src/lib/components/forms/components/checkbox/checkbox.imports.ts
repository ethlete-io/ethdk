import { LabelComponent } from '../label';
import { CheckboxComponent, CheckboxFieldComponent, CheckboxGroupComponent } from './components';
import { CheckboxGroupControlDirective } from './directives';

export const CheckboxImports = [
  CheckboxComponent,
  CheckboxFieldComponent,
  CheckboxGroupComponent,
  CheckboxGroupControlDirective,
  LabelComponent,
] as const;
