import {
  TimePickerColumnDirective,
  TimePickerDirective,
  TimePickerOptionDirective,
  TimePickerRingDirective,
  TimePickerRingHandleDirective,
} from './headless';
import { TimePickerComponent } from './time-picker.component';

export const TIME_PICKER_IMPORTS = [
  TimePickerComponent,
  TimePickerDirective,
  TimePickerColumnDirective,
  TimePickerOptionDirective,
  TimePickerRingDirective,
  TimePickerRingHandleDirective,
] as const;
