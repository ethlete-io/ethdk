import { ToggletipCloseDirective, ToggletipDirective, ToggletipTriggerDirective } from './headless';
import { ToggletipComponent } from './toggletip.component';

export const TOGGLETIP_IMPORTS = [
  ToggletipDirective,
  ToggletipCloseDirective,
  ToggletipTriggerDirective,
  ToggletipComponent,
] as const;
