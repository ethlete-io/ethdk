import { CascaderPanelComponent } from './cascader-panel.component';
import { CascaderComponent } from './cascader.component';
import {
  CascaderColumnDirective,
  CascaderDirective,
  CascaderNodeDirective,
  CascaderSurfaceDirective,
  CascaderTriggerDirective,
} from './headless';

export const CASCADER_IMPORTS = [
  CascaderComponent,
  CascaderPanelComponent,
  CascaderDirective,
  CascaderTriggerDirective,
  CascaderSurfaceDirective,
  CascaderColumnDirective,
  CascaderNodeDirective,
] as const;
