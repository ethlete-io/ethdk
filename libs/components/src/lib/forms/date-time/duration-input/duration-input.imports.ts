import { DurationInputComponent } from './duration-input.component';
import { DurationInputDirective, DurationInputFieldDirective } from './headless';

export const DURATION_INPUT_IMPORTS = [
  DurationInputComponent,
  DurationInputDirective,
  DurationInputFieldDirective,
] as const;
