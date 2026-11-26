import { ChipComponent } from './chip.component';
import { ChipDirective, ChipRemoveDirective } from './headless';

export const CHIP_IMPORTS = [ChipComponent, ChipDirective, ChipRemoveDirective] as const;
