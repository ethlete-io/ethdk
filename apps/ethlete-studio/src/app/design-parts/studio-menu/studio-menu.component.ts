import { booleanAttribute, Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';

export type StudioMenuAction = 'settings' | 'appearance' | 'shortcuts' | 'help' | 'about';

@Component({
  selector: 'ethlete-studio-menu',
  templateUrl: './studio-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, AutoSurfaceDirective],
  host: {
    '[class]':
      "bare() ? 'block size-10' : 'box-border block h-64 w-xl bg-et-surface-bg p-space-3 font-ui text-ui-md text-et-surface'",
  },
})
export class StudioMenuComponent {
  public bare = input(false, { transform: booleanAttribute });
  public open = model(false);

  public action = output<StudioMenuAction>();
}
