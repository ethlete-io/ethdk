import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { TimeInputDirective, TimeInputFieldDirective } from './headless';
import { TimeInputComponent } from './time-input.component';

export const TIME_INPUT_IMPORTS = [
  TimeInputComponent,
  TimeInputDirective,
  TimeInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
