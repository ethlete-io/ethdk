import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimeInputComponent } from './date-time-input.component';
import { DateTimeInputDirective, DateTimeInputFieldDirective } from './headless';

export const DATE_TIME_INPUT_IMPORTS = [
  DateTimeInputComponent,
  DateTimeInputDirective,
  DateTimeInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
