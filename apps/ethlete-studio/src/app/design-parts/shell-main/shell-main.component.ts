import { booleanAttribute, Component, computed, input, model, output, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, SpinnerComponent, TOOLTIP_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective } from '@ethlete/core';
import { WindowChrome } from '../../../host/window';
import { injectCodeWatch } from '../../code-watch';
import { TitleBarComponent } from '../../components/title-bar/title-bar.component';
import { DESIGN_SERVER_LABELS, SHELL_LABELS } from '../../i18n/shell-labels';
import { ShellCollapseComponent } from '../shell-collapse/shell-collapse.component';
import { ShellResizeHandleComponent } from '../shell-resize-handle/shell-resize-handle.component';
import { ProductSdk, ShellSystemPickerComponent } from '../shell-system-picker/shell-system-picker.component';
import { railLetters } from './rail-letters';
import { clampSideWidth, SIDE_WIDTH } from './side-width';

export type ServerCrash = { time: string; pid: number; port: number; path: string; stack: readonly string[] };

export type StartPhase = 'starting' | 'cli-build' | 'app-build';

export type ShellSection = 'System' | 'Sketches' | 'Flows' | 'Inbox';

const SECTIONS: { label: ShellSection; icon: string }[] = [
  { label: 'System', icon: 'grid' },
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
    TOOLTIP_IMPORTS,
    AutoSurfaceDirective,
    ShellCollapseComponent,
    ShellResizeHandleComponent,
    ShellSystemPickerComponent,
    SpinnerComponent,
    TitleBarComponent,
  ],
  host: { '[class]': "fill() ? 'block size-full' : 'block h-225 w-360'" },
})
export class ShellMainComponent {
  protected codeWatch = injectCodeWatch();
  public fill = input(false, { transform: booleanAttribute });
  public section = input<ShellSection>('System');
  public product = input('studio');
  public products = input(['studio', 'timetrack', 'docs']);
  public sdk = input<ProductSdk | null>(null);
  public logos = input<Record<string, string | null | undefined>>({});
  public panel = input<'open' | 'hidden'>('open');
  public systemPicker = model<'open' | 'closed'>('closed');
  public server = input<'stopped' | 'starting' | 'unanswered' | 'crashed' | null>(null);
  public phase = input<StartPhase>('starting');
  public phaseMs = input(0);
  public log = input<readonly string[]>([]);
  public serverUrl = input('');
  public crash = input<ServerCrash | null>(null);
  public chrome = input<Pick<WindowChrome, 'os' | 'left' | 'right'> | null>(null);

  public update = input(false);
  public sideWidth = model<number>(SIDE_WIDTH.rest);
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public sdkChange = output<ProductSdk>();
  public collapse = output();
  public restartServer = output();
  public minimizeRequest = output();
  public maximizeRequest = output();

  public closeRequest = output();
  protected readonly SECTIONS = SECTIONS;
  protected railLabels = computed(() => railLetters(this.products()));
  protected railSection = computed(() => (this.section() === 'Sketches' ? 'System' : this.section()));

  protected readonly LABELS = DESIGN_SERVER_LABELS;
  protected readonly SHELL_LABELS = SHELL_LABELS;
  protected dragWidth = signal<number | null>(null);
  protected shownWidth = computed(() => this.dragWidth() ?? clampSideWidth(this.sideWidth()));
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

  protected setSystemPicker(open: boolean) {
    this.systemPicker.set(open ? 'open' : 'closed');
  }
}
