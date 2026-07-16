import { DateInputComponent } from './date-input.component';
import {
  DateInputDirective,
  DateInputFieldDirective,
  DatePickerSurfaceDirective,
  DatePickerTriggerDirective,
} from './headless';

export const DATE_INPUT_IMPORTS = [
  DateInputComponent,
  DateInputDirective,
  DateInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
