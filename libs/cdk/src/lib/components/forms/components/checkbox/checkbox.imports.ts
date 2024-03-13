import { LabelComponent } from '../label/components/label';
import { CheckboxComponent } from './components/checkbox';
import { CheckboxFieldComponent } from './components/checkbox-field';
import { CheckboxGroupComponent } from './components/checkbox-group';
import { CheckboxGroupControlDirective } from './directives/checkbox-group-control';

export const CheckboxImports = [
  CheckboxComponent,
  CheckboxFieldComponent,
  CheckboxGroupComponent,
  CheckboxGroupControlDirective,
  LabelComponent,
] as const;
