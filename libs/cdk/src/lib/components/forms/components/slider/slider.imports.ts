import { LabelComponent } from '../label/components/label';
import { SliderComponent } from './components/slider';
import { SliderFieldComponent } from './components/slider-field';
import { SliderThumbContentTemplateDirective } from './directives/slider-thumb-content-template';

export const SliderImports = [
  SliderComponent,
  SliderFieldComponent,
  LabelComponent,
  SliderThumbContentTemplateDirective,
] as const;
