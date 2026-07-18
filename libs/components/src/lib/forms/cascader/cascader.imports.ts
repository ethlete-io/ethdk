import { CascaderPanelComponent } from './cascader-panel.component';
import { CascaderComponent } from './cascader.component';
import {
  CascaderColumnDirective,
  CascaderDirective,
  CascaderNodeDirective,
  CascaderSearchDirective,
  CascaderSearchOptionDirective,
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
  CascaderSearchDirective,
  CascaderSearchOptionDirective,
] as const;
