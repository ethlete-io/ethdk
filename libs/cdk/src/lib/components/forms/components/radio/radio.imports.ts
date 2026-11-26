import { LabelComponent } from '../label/components/label';
import { RadioComponent } from './components/radio';
import { RadioFieldComponent } from './components/radio-field';
import { RadioGroupComponent } from './components/radio-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RadioImports = [RadioComponent, RadioFieldComponent, RadioGroupComponent, LabelComponent] as const;
