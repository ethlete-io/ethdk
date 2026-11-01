import { booleanAttribute, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type DesignServerAction = 'start' | 'restart' | 'stop';

export type DesignServerStatus = 'running' | 'stopped';

const SERVER_ACTIONS: Record<DesignServerStatus, DesignServerAction[]> = {
  running: ['restart', 'stop'],
  stopped: ['start'],
};

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
  public server = input<DesignServerStatus>('running');

  public serverAction = output<DesignServerAction>();

  protected items = computed(() =>
    SERVER_ACTIONS[this.server()].map((action) => ({ action, label: STUDIO_LABELS.designServer[action] })),
  );
}
