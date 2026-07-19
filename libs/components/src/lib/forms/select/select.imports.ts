import {
  SelectDirective,
  SelectEmptyDirective,
  SelectErrorDirective,
  SelectListboxDirective,
  SelectLoadingDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectOptionTemplateDirective,
  SelectSearchDirective,
  SelectSurfaceDirective,
  SelectTriggerDirective,
  SelectValueDirective,
  SelectViewportDirective,
  SelectVirtualOptionDirective,
} from './headless';
import { SelectOptionGroupComponent } from './select-option-group.component';
import { SelectOptionComponent } from './select-option.component';
import { SelectPanelComponent } from './select-panel.component';
import { SelectVirtualOptionComponent } from './select-virtual-option.component';
import { SelectComponent } from './select.component';

export const SELECT_IMPORTS = [
  SelectComponent,
  SelectOptionComponent,
  SelectOptionGroupComponent,
  SelectPanelComponent,
  SelectVirtualOptionComponent,
  SelectDirective,
  SelectTriggerDirective,
  SelectSurfaceDirective,
  SelectListboxDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectOptionTemplateDirective,
  SelectValueDirective,
  SelectSearchDirective,
  SelectViewportDirective,
  SelectVirtualOptionDirective,
  SelectLoadingDirective,
  SelectErrorDirective,
  SelectEmptyDirective,
] as const;
