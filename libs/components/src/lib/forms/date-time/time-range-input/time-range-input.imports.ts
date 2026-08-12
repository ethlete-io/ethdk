import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { TimeRangeInputDirective, TimeRangeInputFieldDirective } from './headless';
import { TimeRangeInputComponent } from './time-range-input.component';

export const TIME_RANGE_INPUT_IMPORTS = [
  TimeRangeInputComponent,
  TimeRangeInputDirective,
  TimeRangeInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
