import {
  SelectDirective,
  SelectEmptyDirective,
  SelectErrorDirective,
  SelectListboxDirective,
  SelectLoadingDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectSearchDirective,
  SelectSurfaceDirective,
  SelectTriggerDirective,
  SelectValueDirective,
} from './headless';
import { SelectOptionGroupComponent } from './select-option-group.component';
import { SelectOptionComponent } from './select-option.component';
import { SelectPanelComponent } from './select-panel.component';
import { SelectComponent } from './select.component';

export const SELECT_IMPORTS = [
  SelectComponent,
  SelectOptionComponent,
  SelectOptionGroupComponent,
  SelectPanelComponent,
  SelectDirective,
  SelectTriggerDirective,
  SelectSurfaceDirective,
  SelectListboxDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectValueDirective,
  SelectSearchDirective,
  SelectLoadingDirective,
  SelectErrorDirective,
  SelectEmptyDirective,
] as const;
