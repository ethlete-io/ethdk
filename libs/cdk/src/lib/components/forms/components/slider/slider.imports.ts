import { LabelComponent } from '../label/components/label';
import { SliderComponent } from './components/slider';
import { SliderFieldComponent } from './components/slider-field';
import { SliderThumbContentTemplateDirective } from './directives/slider-thumb-content-template';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SliderImports = [
  SliderComponent,
  SliderFieldComponent,
  LabelComponent,
  SliderThumbContentTemplateDirective,
] as const;
