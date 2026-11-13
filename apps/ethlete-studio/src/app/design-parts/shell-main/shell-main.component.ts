import { booleanAttribute, Component, computed, input, model, output, signal, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS, MENU_IMPORTS } from '@ethlete/components';
import { AutoSurfaceDirective, DragHandleDirective, DragMoveEvent } from '@ethlete/core';
import { WindowChrome } from '../../../host/window';
import { injectCodeWatch } from '../../code-watch';
import { TitleBarComponent } from '../../components/title-bar/title-bar.component';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { ShellCollapseComponent } from '../shell-collapse/shell-collapse.component';
import { clampSideWidth, SIDE_WIDTH, sideWidthForKey } from './side-width';

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
    MENU_IMPORTS,
    AutoSurfaceDirective,
    DragHandleDirective,
    ShellCollapseComponent,
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
  public panel = input<'open' | 'hidden'>('open');
  public systemPicker = model<'open' | 'closed'>('closed');
  public server = input<'stopped' | 'starting' | null>(null);
  public log = input<readonly string[]>([]);
  public chrome = input<Pick<WindowChrome, 'os' | 'left' | 'right'> | null>(null);

  public update = input(false);
  public sideWidth = model<number>(SIDE_WIDTH.rest);
  public sectionChange = output<ShellSection>();
  public productChange = output<string>();
  public collapse = output();
  public restartServer = output();
  public updateRequest = output<MouseEvent>();
  public minimizeRequest = output();
  public maximizeRequest = output();

  public closeRequest = output();
  protected readonly SECTIONS = SECTIONS;

  protected readonly LABELS = STUDIO_LABELS.designServer;
  protected readonly SHELL_LABELS = STUDIO_LABELS.shell;
  protected readonly SIDE_WIDTH = SIDE_WIDTH;
  protected dragWidth = signal<number | null>(null);
  protected shownWidth = computed(() => this.dragWidth() ?? clampSideWidth(this.sideWidth()));
  private dragFrom: number = SIDE_WIDTH.rest;
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

  protected startResize() {
    this.dragFrom = this.shownWidth();
  }

  protected moveResize(event: DragMoveEvent) {
    this.dragWidth.set(clampSideWidth(this.dragFrom + event.totalDx));
  }

  protected endResize() {
    const width = this.dragWidth();

    this.dragWidth.set(null);

    if (width !== null) this.sideWidth.set(width);
  }

  protected resizeByKey(event: KeyboardEvent) {
    const width = sideWidthForKey(this.shownWidth(), event.key);

    if (width === null) return;

    event.preventDefault();
    this.sideWidth.set(width);
  }

  protected setSystemPicker(open: boolean) {
    this.systemPicker.set(open ? 'open' : 'closed');
  }

  protected selectProduct(value: unknown) {
    if (typeof value === 'string' && value !== this.product()) this.productChange.emit(value);
  }
}
