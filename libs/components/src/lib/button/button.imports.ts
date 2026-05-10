import { ButtonComponent } from './button.component';
import { FabComponent } from './fab.component';
import { ButtonDirective } from './headless';
import { IconButtonComponent } from './icon-button.component';
import { TextButtonComponent } from './text-button.component';
import { WindowControlButtonComponent } from './window-control-button.component';

export const BUTTON_IMPORTS = [
  ButtonComponent,
  FabComponent,
  IconButtonComponent,
  TextButtonComponent,
  WindowControlButtonComponent,
  ButtonDirective,
] as const;
