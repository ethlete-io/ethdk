import {
  SelectDirective,
  SelectEmptyDirective,
  SelectErrorDirective,
  SelectListboxDirective,
  SelectLoadingDirective,
  SelectOptionDirective,
  SelectSearchDirective,
  SelectSurfaceDirective,
  SelectTriggerDirective,
  SelectValueDirective,
} from './headless';
import { SelectOptionComponent } from './select-option.component';
import { SelectPanelComponent } from './select-panel.component';
import { SelectComponent } from './select.component';

export const SELECT_IMPORTS = [
  SelectComponent,
  SelectOptionComponent,
  SelectPanelComponent,
  SelectDirective,
  SelectTriggerDirective,
  SelectSurfaceDirective,
  SelectListboxDirective,
  SelectOptionDirective,
  SelectValueDirective,
  SelectSearchDirective,
  SelectLoadingDirective,
  SelectErrorDirective,
  SelectEmptyDirective,
] as const;
