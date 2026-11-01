import { booleanAttribute, Component, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { ShellCollapseComponent } from '../shell-collapse/shell-collapse.component';

export type ShellSection = 'System' | 'Sketches' | 'Flows' | 'Inbox';

const SECTIONS: { label: ShellSection; icon: string }[] = [
  { label: 'System', icon: 'grid' },
  { label: 'Sketches', icon: 'pencil' },
  { label: 'Flows', icon: 'flow' },
  { label: 'Inbox', icon: 'inbox' },
];

const HOVER_PRESS = 'bg-transparent hover:bg-et-surface-interaction/9 active:bg-et-surface-interaction/15';

const HOVER_PRESS_RAISED =
  'hover:bg-linear-to-b hover:from-et-surface-interaction/9 hover:to-et-surface-interaction/9 active:bg-linear-to-b active:from-et-surface-interaction/15 active:to-et-surface-interaction/15';

const ALL_PRODUCTS_CLASS = `mt-0.5 size-9 rounded-control-md text-et-surface-muted shadow-[inset_0_0_0_1px_var(--et-surface-border-solid)] ${HOVER_PRESS}`;

@Component({
  selector: 'ethlete-shell-main',
  templateUrl: './shell-main.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, MENU_IMPORTS, AutoSurfaceDirective, ShellCollapseComponent],
  host: { '[class]': "fill() ? 'block size-full' : 'block h-225 w-360'" },
})
export class ShellMainComponent {
  public fill = input(false, { transform: booleanAttribute });
  public section = input<ShellSection>('System');
  public product = input('studio');
  public products = input(['studio', 'timetrack', 'docs']);
  public project = input('ethlete-sdk');
  public projects = input(['ethlete-sdk', 'fut-frontend', 'design-playground']);
  public panel = input<'open' | 'hidden'>('open');
  public projectPicker = model<'open' | 'closed'>('closed');
  public server = input<'stopped' | 'starting' | null>(null);
  public log = input<readonly string[]>([]);

  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public allProducts = output();
  public collapse = output();
  public projectChange = output<string>();
  public openProject = output();
  public restartServer = output();

  protected readonly SECTIONS = SECTIONS;
  protected readonly LABELS = STUDIO_LABELS.designServer;
  protected readonly ALL_PRODUCTS_CLASS = ALL_PRODUCTS_CLASS;

  protected sectionClass(active: boolean) {
    if (active && this.panel() !== 'hidden')
      return 'rounded-control-lg bg-et-theme/20 text-et-theme-ink hover:bg-et-theme/20';

    return `rounded-control-lg ${active ? 'text-et-theme-ink' : 'text-et-surface-muted'} ${HOVER_PRESS}`;
  }

  protected productClass(active: boolean) {
    return `my-0.5 size-9 rounded-control-md bg-et-surface-bg ${active ? 'text-et-surface shadow-[inset_0_0_0_1px_var(--et-surface-border-solid)]' : 'text-et-surface-muted'} ${HOVER_PRESS_RAISED}`;
  }

  protected pickSection(section: ShellSection, active: boolean) {
    if (active && this.panel() !== 'hidden') this.collapse.emit();
    else this.sectionChange.emit(section);
  }

  protected selectProject(value: unknown) {
    if (typeof value === 'string') this.projectChange.emit(value);
  }

  protected setProjectPicker(open: boolean) {
    this.projectPicker.set(open ? 'open' : 'closed');
  }
}
