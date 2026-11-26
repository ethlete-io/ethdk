import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateTimeRangeInputComponent } from './date-time-range-input.component';
import { DateTimeRangeInputDirective, DateTimeRangeInputFieldDirective } from './headless';

export const DATE_TIME_RANGE_INPUT_IMPORTS = [
  DateTimeRangeInputComponent,
  DateTimeRangeInputDirective,
  DateTimeRangeInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
