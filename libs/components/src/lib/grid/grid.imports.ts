import { GridDebugComponent } from './grid-debug.component';
import { GridItemDefaultActionsComponent } from './grid-item-default-actions.component';
import { GridItemToolbarComponent } from './grid-item-toolbar.component';
import { GridItemComponent } from './grid-item.component';
import { GridComponent } from './grid.component';

export const GridImports = [
  GridComponent,
  GridItemComponent,
  GridItemToolbarComponent,
  GridItemDefaultActionsComponent,
  GridDebugComponent,
] as const;
