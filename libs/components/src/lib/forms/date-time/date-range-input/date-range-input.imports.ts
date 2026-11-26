import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateRangeInputComponent } from './date-range-input.component';
import { DateRangeInputDirective, DateRangeInputFieldDirective } from './headless';

export const DATE_RANGE_INPUT_IMPORTS = [
  DateRangeInputComponent,
  DateRangeInputDirective,
  DateRangeInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
