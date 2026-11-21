import { booleanAttribute, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type DesignServerAction = 'start' | 'restart' | 'stop';

export type DesignServerStatus = 'running' | 'stale' | 'stopped';

type ServerRow = DesignServerAction | 'reload';

const SERVER_ROWS: Record<DesignServerStatus, ServerRow[]> = {
  running: ['reload', 'restart', 'stop'],
  stale: ['restart', 'reload', 'stop'],
  stopped: ['start'],
};

@Component({
  selector: 'ethlete-studio-menu',
  templateUrl: './studio-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, AutoSurfaceDirective],
  host: {
    '[class]': "bare() ? 'block size-10' : 'box-border block h-120 w-3xl p-space-3 font-ui text-ui-md text-et-surface'",
  },
})
export class StudioMenuComponent {
  public bare = input(false, { transform: booleanAttribute });
  public open = model(false);
  public busy = input(false, { transform: booleanAttribute });
  public server = input<DesignServerStatus>('running');
  public project = input('');
  public projects = input<readonly string[]>([]);

  public serverAction = output<DesignServerAction>();
  public reload = output();
  public scanProjects = output();
  public openInventory = output();
  public projectChange = output<string>();
  public openProject = output();
  public showShortcuts = output();
  public openHelp = output();
  public showAbout = output();

  protected readonly LABELS = STUDIO_LABELS.studioMenu;

  protected statusLabel = computed(() => `${this.LABELS.designServer} · ${this.LABELS.serverStatus[this.server()]}`);

  protected items = computed(() =>
    SERVER_ROWS[this.server()].map((row) => ({
      row,
      label: row === 'reload' ? this.LABELS.reload : STUDIO_LABELS.designServer[row],
    })),
  );

  protected runRow(row: ServerRow) {
    if (row === 'reload') this.reload.emit();
    else this.serverAction.emit(row);
  }

  protected selectProject(value: unknown) {
    if (typeof value === 'string' && value !== this.project()) this.projectChange.emit(value);
  }
}
