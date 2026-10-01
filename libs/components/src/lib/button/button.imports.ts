import { ButtonComponent } from './button.component';
import { FabComponent } from './fab.component';
import {
  ButtonDirective,
  QueryButtonDirective,
  SplitButtonActionDirective,
  SplitButtonDirective,
  SplitButtonTriggerDirective,
} from './headless';
import { IconButtonComponent } from './icon-button.component';
import { SplitButtonComponent } from './split-button.component';
import { TextButtonComponent } from './text-button.component';
import { WindowControlButtonComponent } from './window-control-button.component';

export const BUTTON_IMPORTS = [
  ButtonComponent,
  FabComponent,
  IconButtonComponent,
  SplitButtonComponent,
  TextButtonComponent,
  WindowControlButtonComponent,
  ButtonDirective,
  QueryButtonDirective,
  SplitButtonDirective,
  SplitButtonActionDirective,
  SplitButtonTriggerDirective,
] as const;
