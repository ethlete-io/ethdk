import { DatePickerSurfaceDirective } from '../picker/date-picker-surface.directive';
import { DatePickerTriggerDirective } from '../picker/date-picker-trigger.directive';
import { DateInputComponent } from './date-input.component';
import { DateInputDirective, DateInputFieldDirective } from './headless';

export const DATE_INPUT_IMPORTS = [
  DateInputComponent,
  DateInputDirective,
  DateInputFieldDirective,
  DatePickerTriggerDirective,
  DatePickerSurfaceDirective,
] as const;
