import { SliderComponent, SliderFieldComponent } from './components';
import { MatSliderRangeThumbDirective, MatSliderThumbDirective } from './directives';
import { SliderThumbComponent } from './partials';

export const SliderImports = [
  SliderComponent,
  SliderFieldComponent,
  SliderThumbComponent,
  MatSliderRangeThumbDirective,
  MatSliderThumbDirective,
] as const;
