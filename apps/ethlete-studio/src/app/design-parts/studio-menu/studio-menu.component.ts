import { booleanAttribute, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';

export type DesignServerAction = 'start' | 'restart' | 'stop';

export type DesignServerStatus = 'running' | 'stopped';

export type Appearance = 'light' | 'dark' | 'system';

const SERVER_ACTIONS: Record<DesignServerStatus, DesignServerAction[]> = {
  running: ['restart', 'stop'],
  stopped: ['start'],
};

const SUBMENU_OFFSET = { mainAxis: 11, crossAxis: -6 };

const APPEARANCES: Appearance[] = ['light', 'dark', 'system'];

@Component({
  selector: 'ethlete-studio-menu',
  templateUrl: './studio-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, AutoSurfaceDirective],
  host: {
    '[class]': "bare() ? 'block size-10' : 'box-border block h-100 w-3xl p-space-3 font-ui text-ui-md text-et-surface'",
  },
})
export class StudioMenuComponent {
  public bare = input(false, { transform: booleanAttribute });
  public open = model(false);
  public appearanceOpen = model(false);
  public helpOpen = model(false);
  public server = input<DesignServerStatus>('running');
  public project = input('');
  public projects = input<readonly string[]>([]);

  public serverAction = output<DesignServerAction>();
  public projectChange = output<string>();
  public openProject = output();
  public appearanceChange = output<Appearance>();
  public openSettings = output();
  public openShortcuts = output();
  public openHelp = output();
  public openAbout = output();

  protected readonly LABELS = STUDIO_LABELS.studioMenu;
  protected readonly APPEARANCES = APPEARANCES;
  protected readonly SUBMENU_OFFSET = SUBMENU_OFFSET;

  protected items = computed(() =>
    SERVER_ACTIONS[this.server()].map((action) => ({ action, label: STUDIO_LABELS.designServer[action] })),
  );

  protected setOpen(open: boolean) {
    this.open.set(open);

    if (open) return;

    this.appearanceOpen.set(false);
    this.helpOpen.set(false);
  }

  protected setAppearanceOpen(open: boolean) {
    this.appearanceOpen.set(open);

    if (open) this.helpOpen.set(false);
  }

  protected setHelpOpen(open: boolean) {
    this.helpOpen.set(open);

    if (open) this.appearanceOpen.set(false);
  }

  protected selectProject(value: unknown) {
    if (typeof value === 'string' && value !== this.project()) this.projectChange.emit(value);
  }
}
