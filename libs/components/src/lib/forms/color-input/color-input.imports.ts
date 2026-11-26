import { ColorInputComponent } from './color-input.component';
import { ColorPickerPanelComponent } from './color-picker-panel.component';
import {
  ColorInputDirective,
  ColorPickerAreaDirective,
  ColorPickerChannelDirective,
  ColorPickerSurfaceDirective,
  ColorPickerTriggerDirective,
} from './headless';

export const COLOR_INPUT_IMPORTS = [
  ColorInputComponent,
  ColorInputDirective,
  ColorPickerAreaDirective,
  ColorPickerChannelDirective,
  ColorPickerPanelComponent,
  ColorPickerSurfaceDirective,
  ColorPickerTriggerDirective,
] as const;
