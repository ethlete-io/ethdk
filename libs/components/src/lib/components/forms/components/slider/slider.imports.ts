import { SliderComponent, SliderFieldComponent } from './components';
import { SliderRangeThumbDirective, SliderThumbDirective } from './directives';
import { SliderThumbComponent } from './partials';

export const SliderImports = [
  SliderComponent,
  SliderFieldComponent,
  SliderThumbComponent,
  SliderRangeThumbDirective,
  SliderThumbDirective,
] as const;
