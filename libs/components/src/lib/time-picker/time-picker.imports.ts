import { TimePickerDirective, TimePickerRingDirective, TimePickerRingHandleDirective } from './headless';
import { TimePickerComponent } from './time-picker.component';

export const TIME_PICKER_IMPORTS = [
  TimePickerComponent,
  TimePickerDirective,
  TimePickerRingDirective,
  TimePickerRingHandleDirective,
] as const;
