import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, TemplateRef, ViewEncapsulation } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { PartTreeComponent, PartTreeLayer } from '../part-tree/part-tree.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';

export type InventoryPageState = 'open' | 'approvable' | 'approved' | 'loading';

export const INVENTORY_PAGE_TREE: PartTreeLayer[] = [
  { title: 'Foundations', open: false, parts: [] },
  { title: 'Elements', open: false, parts: [] },
  { title: 'Components', open: false, parts: [] },
  {
    title: 'Pages',
    open: true,
    parts: [{ name: 'flows', leaf: true, selected: true }, { name: 'inbox' }, { name: 'system' }],
  },
];

export type InventoryPageStatus = 'declared' | 'owned' | 'undeclared' | 'unclassified';

export type InventoryPageBox = { x: number; y: number; width: number; height: number };

export type InventoryPageEntry = {
  number?: number;
  id: string;
  label?: string;
  status: InventoryPageStatus;
  owner?: string;
  kind: string;
  states: number;
  box?: InventoryPageBox;
};

export type InventoryPageMark = { number: number; status: InventoryPageStatus; box: InventoryPageBox };

export type InventoryPageFrame = {
  key: string;
  label: string;
  width: number;
  height: number;
  marks: InventoryPageMark[];
};

export const INVENTORY_PAGE_ENTRIES: InventoryPageEntry[] = [
  {
    id: 'studio-menu',
    label: 'Studio',
    status: 'undeclared',
    kind: 'button',
    states: 1,
    box: { x: 12, y: 12, width: 40, height: 40 },
  },
  {
    id: 'rail.system',
    label: 'System',
    status: 'owned',
    owner: 'elements/shell-main',
    kind: 'button',
    states: 2,
    box: { x: 12, y: 72, width: 40, height: 40 },
  },
  {
    id: 'rail.flows',
    label: 'Flows',
    status: 'owned',
    owner: 'elements/shell-main',
    kind: 'button',
    states: 2,
    box: { x: 12, y: 120, width: 40, height: 40 },
  },
  {
    id: 'flow-row',
    label: 'Sketch prüfen',
    status: 'declared',
    kind: 'row',
    states: 2,
    box: { x: 72, y: 72, width: 216, height: 28 },
  },
  {
    id: 'preset-picker',
    label: 'Desktop · 1440 × 900',
    status: 'unclassified',
    kind: 'select',
    states: 1,
    box: { x: 1172, y: 20, width: 240, height: 36 },
  },
];

const FRAME_SCALE = 0.5;

@Component({
  selector: 'ethlete-inventory-page',
  template: `
    <ethlete-shell-page [shell]="shell()" (action)="shellAction.emit($event)" section="System">
      <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto p-space-2" shellMainSide>
        <ethlete-part-tree
          [layers]="tree()"
          (expandedChange)="expandedChange.emit($event)"
          (activate)="pick.emit($event)"
        />
      </div>
      <div class="box-border flex h-full flex-col ps-(--st-shell-inset-left)">
        <div class="flex h-14 flex-none items-center gap-space-3 px-space-4">
          <span class="text-ui-lg font-ui-strong">{{ part() }}</span>
          <span class="flex-1"></span>
          <button (click)="inventoryToggle.emit()" pressed et-button type="button" variant="outline" size="sm">
            {{ LABELS.toggle }}
          </button>
        </div>
        <div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] bg-et-surface-bg">
          <header
            class="flex flex-wrap items-center gap-space-3 border-b border-et-surface-border px-space-4 py-space-3"
          >
            <h2 class="m-0 text-ui-lg font-ui-strong">{{ LABELS.title }}</h2>
            @if (!loading()) {
              <span class="text-ui-sm text-et-surface-muted">{{ approvalShown() }}</span>
            }
            <span class="flex-1"></span>
            <button [disabled]="loading()" (click)="reload.emit()" et-button type="button" variant="outline" size="sm">
              {{ LABELS.reload }}
            </button>
            <button
              [disabled]="approveBlocked()"
              (click)="approve.emit()"
              et-button
              type="button"
              variant="filled"
              size="sm"
            >
              {{ LABELS.approve }}
            </button>
          </header>
          @if (loading()) {
            <p class="m-0 p-space-4 text-ui-sm text-et-surface-muted">{{ LABELS.drawing }}</p>
          } @else {
            <div class="grid min-h-0 grid-cols-[minmax(0,1fr)_32rem]">
              <div class="flex min-h-0 flex-col gap-space-6 overflow-auto p-space-4">
                @for (frame of framesShown(); track frame.key) {
                  <figure class="m-0 flex flex-col gap-space-2">
                    <figcaption class="font-code text-ui-sm text-et-surface-muted">{{ frame.label }}</figcaption>
                    <div class="relative self-start border border-et-surface-border">
                      @if (shotTemplate(); as shot) {
                        <ng-container *ngTemplateOutlet="shot; context: { $implicit: frame }" />
                      } @else {
                        <div
                          [style.width.px]="frame.width * SCALE"
                          [style.height.px]="frame.height * SCALE"
                          class="bg-et-surface-bg"
                        ></div>
                      }
                      @for (mark of frame.marks; track mark.number) {
                        <div
                          [etProvideColor]="themeOf(mark.status)"
                          [style.left]="PERCENT_OF(mark.box.x, frame.width)"
                          [style.top]="PERCENT_OF(mark.box.y, frame.height)"
                          [style.width]="PERCENT_OF(mark.box.width, frame.width)"
                          [style.height]="PERCENT_OF(mark.box.height, frame.height)"
                          class="pointer-events-none absolute border-2 border-et-theme"
                        >
                          <span
                            class="absolute -top-2 -left-2 rounded-full bg-et-theme px-1 font-code text-ui-xs leading-4 text-et-theme-ink"
                            >{{ mark.number }}</span
                          >
                        </div>
                      }
                    </div>
                  </figure>
                }
              </div>
              <ol
                class="m-0 flex min-h-0 list-none flex-col gap-space-2 overflow-auto border-l border-et-surface-border p-space-4"
              >
                @for (entry of shown(); track entry.id; let index = $index) {
                  <li [etProvideColor]="themeOf(entry.status)" class="flex gap-space-2 text-ui-sm">
                    <span class="h-fit shrink-0 rounded-full bg-et-theme px-1.5 font-code text-et-theme-ink">{{
                      entry.number ?? index
                    }}</span>
                    <span class="flex min-w-0 flex-col">
                      @if (entry.label) {
                        <span class="text-et-surface">{{ entry.label }}</span>
                      }
                      <span class="font-code break-all text-et-surface">{{ entry.id }}</span>
                      <span class="text-et-surface-muted"
                        >{{ entry.owner ? LABELS.ownedBy(entry.owner) : LABELS.status[entry.status] }} ·
                        {{ entry.kind }} · {{ entry.states }} {{ LABELS.states(entry.states) }}</span
                      >
                    </span>
                  </li>
                }
              </ol>
            </div>
          }
        </div>
      </div>
    </ethlete-shell-page>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, ShellPageComponent, PartTreeComponent, BUTTON_IMPORTS, ProvideColorDirective],
  host: { class: 'block h-screen w-full' },
})
export class InventoryPageComponent {
  private errorTheme = injectSemanticColorTheme('error');
  private warningTheme = injectSemanticColorTheme('warning');
  public shell = input<ShellState>(SHELL_SAMPLE);
  public inventory = input<InventoryPageState>('open');
  public tree = input(INVENTORY_PAGE_TREE);
  public entries = input(INVENTORY_PAGE_ENTRIES);

  public part = input('pages/flows');
  public approval = input<string | null>(null);
  public approvable = input<boolean | null>(null);
  public frames = input<InventoryPageFrame[] | null>(null);
  public shotTemplate = input<TemplateRef<{ $implicit: InventoryPageFrame }> | null>(null);
  public shellAction = output<ShellAction>();

  public reload = output();
  public approve = output();
  public inventoryToggle = output();

  public pick = output<string>();
  public expandedChange = output<readonly string[]>();

  protected readonly LABELS = STUDIO_LABELS.inventory;
  protected readonly SCALE = FRAME_SCALE;
  protected readonly PERCENT_OF = percentOf;
  protected loading = computed(() => this.inventory() === 'loading');
  protected approvalShown = computed(
    () => this.approval() ?? (this.inventory() === 'approved' ? this.LABELS.approvedBy : this.LABELS.notApproved),
  );
  protected approveBlocked = computed(() => !(this.approvable() ?? this.inventory() === 'approvable'));
  protected shown = computed(() =>
    this.inventory() === 'open'
      ? this.entries()
      : this.entries().map((entry) =>
          entry.status === 'undeclared' || entry.status === 'unclassified'
            ? { ...entry, status: 'declared' as const }
            : entry,
        ),
  );
  protected framesShown = computed<InventoryPageFrame[]>(
    () =>
      this.frames() ?? [
        {
          key: 'sample',
          label: this.LABELS.frame,
          width: 1440,
          height: 900,
          marks: this.shown().flatMap((entry, index) =>
            entry.box ? [{ number: index, status: entry.status, box: entry.box }] : [],
          ),
        },
      ],
  );
  protected themeOf(status: InventoryPageStatus) {
    return status === 'undeclared' ? this.errorTheme() : status === 'unclassified' ? this.warningTheme() : undefined;
  }
}

const percentOf = (value: number, of: number) => `${(value / of) * 100}%`;
