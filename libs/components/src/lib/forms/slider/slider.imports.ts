import {
  RangeSliderDirective,
  SliderDirective,
  SliderThumbDirective,
  SliderThumbLabelDirective,
  SliderTrackDirective,
} from './headless';
import { RangeSliderComponent } from './range-slider.component';
import { SliderComponent } from './slider.component';

export const SLIDER_IMPORTS = [
  SliderComponent,
  RangeSliderComponent,
  SliderDirective,
  RangeSliderDirective,
  SliderThumbDirective,
  SliderThumbLabelDirective,
  SliderTrackDirective,
] as const;
