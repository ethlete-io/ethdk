import {
  SelectAllOptionDirective,
  SelectDirective,
  SelectEmptyDirective,
  SelectErrorDirective,
  SelectListboxDirective,
  SelectLoadingDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectOptionTemplateDirective,
  SelectOptionsDirective,
  SelectSearchDirective,
  SelectSurfaceDirective,
  SelectTriggerDirective,
  SelectValueDirective,
  SelectViewportDirective,
  SelectVirtualOptionDirective,
} from './headless';
import { SelectAllOptionComponent } from './select-all-option.component';
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
  SelectAllOptionComponent,
  SelectDirective,
  SelectTriggerDirective,
  SelectSurfaceDirective,
  SelectListboxDirective,
  SelectOptionDirective,
  SelectOptionGroupDirective,
  SelectOptionTemplateDirective,
  SelectValueDirective,
  SelectSearchDirective,
  SelectOptionsDirective,
  SelectViewportDirective,
  SelectVirtualOptionDirective,
  SelectAllOptionDirective,
  SelectLoadingDirective,
  SelectErrorDirective,
  SelectEmptyDirective,
] as const;
