import { GridDebugComponent } from './grid-debug.component';
import { GridItemDefaultActionsComponent } from './grid-item-default-actions.component';
import { GridItemToolbarComponent } from './grid-item-toolbar.component';
import { GridItemComponent } from './grid-item.component';
import { GridComponent } from './grid.component';

/** The grid, its items, the item toolbar and the default item actions. */
export const GRID_IMPORTS = [
  GridComponent,
  GridItemComponent,
  GridItemToolbarComponent,
  GridItemDefaultActionsComponent,
] as const;

/**
 * The development-only debug overlay (`<et-grid-debug [grid]="…" />`). Separate so it never reaches a
 * production bundle - the `et-grid-debug` localStorage flag only gates it at runtime.
 */
export const GRID_DEBUG_IMPORTS = [GridDebugComponent] as const;
