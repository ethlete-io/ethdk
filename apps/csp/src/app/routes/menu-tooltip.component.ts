import { Component, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS, TOOLTIP_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-menu-tooltip',
  template: `
    <div etMenu placement="bottom-start">
      <button etMenuTrigger et-button type="button" data-testid="menu-trigger">File</button>
      <ng-template etMenuSurface>
        <et-menu>
          <button et-menu-item type="button">New file</button>
          <et-menu-separator />
          <button et-menu-item variant="destructive" type="button">Delete</button>
        </et-menu>
      </ng-template>
    </div>
    <button etTooltip="Tooltip text" et-button type="button" placement="top" data-testid="tooltip-trigger">
      Hover me
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, TOOLTIP_IMPORTS],
})
export class MenuTooltipRouteComponent {}
