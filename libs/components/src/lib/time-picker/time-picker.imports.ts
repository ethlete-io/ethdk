import { TimePickerColumnDirective, TimePickerDirective, TimePickerOptionDirective } from './headless';
import { TimePickerComponent } from './time-picker.component';

export const TIME_PICKER_IMPORTS = [
  TimePickerComponent,
  TimePickerDirective,
  TimePickerColumnDirective,
  TimePickerOptionDirective,
] as const;
