import { LabelComponent } from '../label/components/label';
import { CheckboxComponent } from './components/checkbox';
import { CheckboxFieldComponent } from './components/checkbox-field';
import { CheckboxGroupComponent } from './components/checkbox-group';
import { CheckboxGroupControlDirective } from './directives/checkbox-group-control';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const CheckboxImports = [
  CheckboxComponent,
  CheckboxFieldComponent,
  CheckboxGroupComponent,
  CheckboxGroupControlDirective,
  LabelComponent,
] as const;
