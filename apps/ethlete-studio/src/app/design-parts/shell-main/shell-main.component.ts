import { booleanAttribute, Component, computed, input, model, output, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { WindowChrome } from '../../../host/window';
import { injectCodeWatch } from '../../code-watch';
import { TitleBarComponent } from '../../components/title-bar/title-bar.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { ShellCollapseComponent } from '../shell-collapse/shell-collapse.component';
import { ShellProjectSwitchComponent } from '../shell-project-switch/shell-project-switch.component';

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

@Component({
  selector: 'ethlete-shell-main',
  templateUrl: './shell-main.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    AutoSurfaceDirective,
    ShellCollapseComponent,
    ShellProjectSwitchComponent,
    TitleBarComponent,
  ],
  host: { '[class]': "fill() ? 'block size-full' : 'block h-225 w-360'" },
})
export class ShellMainComponent {
  private codeWatch = injectCodeWatch();
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
  public chrome = input<Pick<WindowChrome, 'os' | 'left' | 'right'> | null>(null);

  public update = input(false);
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public collapse = output();
  public projectChange = output<string>();
  public openProject = output();
  public restartServer = output();
  public updateRequest = output<MouseEvent>();
  public minimizeRequest = output();
  public maximizeRequest = output();

  public closeRequest = output();
  protected readonly SECTIONS = SECTIONS;

  protected readonly LABELS = STUDIO_LABELS.designServer;
  protected codeNoticeText = computed(() => this.codeWatch.notice()?.text ?? null);
  protected codeNoticeAction = computed(() => this.codeWatch.notice()?.action ?? null);

  protected restartCode() {
    const action = this.codeNoticeAction();

    if (action) this.codeWatch.act(action);
  }

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

  protected setProjectPicker(open: boolean) {
    this.projectPicker.set(open ? 'open' : 'closed');
  }
}
