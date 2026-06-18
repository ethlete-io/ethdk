import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, signal, viewChild } from '@angular/core';
import { GridItemComponent } from '../../grid-item.component';
import { GridComponent } from '../../grid.component';
import { createGridAdapter, fromGridPosition, toGridPosition } from '../../headless/grid-adapter';
import { GridItemConfig, GridItemPosition, GridSerializedState } from '../../headless/grid.types';

type BreakpointLayout = { x: number; y: number; cols: number; rows: number };

type PartnerWidgetView = {
  uuid: string;
  title: string;
  type: string;
  layout: { sm: BreakpointLayout; md: BreakpointLayout; lg: BreakpointLayout };
  items: unknown[];
};

const adapter = createGridAdapter<PartnerWidgetView>(
  (widget) => ({
    id: widget.uuid,
    type: widget.type,
    data: { title: widget.title, items: widget.items },
    layout: {
      sm: toGridPosition(widget.layout.sm),
      md: toGridPosition(widget.layout.md),
      lg: toGridPosition(widget.layout.lg),
    },
  }),
  (item) => ({
    uuid: item.id,
    title: (item.data as { title: string }).title,
    type: item.type,
    layout: {
      sm: fromGridPosition(item.layout['sm'] ?? { col: 0, row: 0, colSpan: 2, rowSpan: 1 }),
      md: fromGridPosition(item.layout['md'] ?? { col: 0, row: 0, colSpan: 2, rowSpan: 1 }),
      lg: fromGridPosition(item.layout['lg'] ?? { col: 0, row: 0, colSpan: 3, rowSpan: 1 }),
    },
    items: (item.data as { items: unknown[] }).items ?? [],
  }),
);

const BACKEND_WIDGETS: PartnerWidgetView[] = [
  {
    uuid: 'widget-1',
    title: 'Team Members',
    type: 'team',
    layout: {
      sm: { x: 1, y: 3, cols: 1, rows: 2 },
      md: { x: 2, y: 0, cols: 4, rows: 3 },
      lg: { x: 1, y: 0, cols: 4, rows: 2 },
    },
    items: [],
  },
  {
    uuid: 'widget-2',
    title: 'Contacts',
    type: 'contacts',
    layout: {
      sm: { x: 0, y: 3, cols: 1, rows: 1 },
      md: { x: 0, y: 3, cols: 6, rows: 3 },
      lg: { x: 8, y: 0, cols: 2, rows: 2 },
    },
    items: [],
  },
  {
    uuid: 'widget-3',
    title: 'Summary Card',
    type: 'summary',
    layout: {
      sm: { x: 0, y: 0, cols: 2, rows: 3 },
      md: { x: 0, y: 0, cols: 2, rows: 3 },
      lg: { x: 10, y: 0, cols: 2, rows: 2 },
    },
    items: [],
  },
  {
    uuid: 'widget-4',
    title: 'Content Block',
    type: 'text',
    layout: {
      sm: { x: 0, y: 5, cols: 2, rows: 3 },
      md: { x: 0, y: 6, cols: 6, rows: 3 },
      lg: { x: 0, y: 2, cols: 12, rows: 3 },
    },
    items: [],
  },
  {
    uuid: 'widget-5',
    title: 'Attributes',
    type: 'attribute_list',
    layout: {
      sm: { x: 0, y: 8, cols: 2, rows: 2 },
      md: { x: 0, y: 9, cols: 2, rows: 2 },
      lg: { x: 0, y: 5, cols: 12, rows: 2 },
    },
    items: [],
  },
  {
    uuid: 'widget-6',
    title: 'Details',
    type: 'text',
    layout: {
      sm: { x: 0, y: 10, cols: 2, rows: 4 },
      md: { x: 2, y: 9, cols: 4, rows: 4 },
      lg: { x: 0, y: 7, cols: 12, rows: 4 },
    },
    items: [],
  },
];

const BREAKPOINT_NAMES = ['sm', 'md', 'lg'] as const;

type LayoutRow = {
  id: string;
  type: string;
  breakpoints: {
    name: string;
    ext: GridItemPosition | undefined;
    int: GridItemPosition | undefined;
    extMissing: boolean;
    intMissing: boolean;
    mismatch: boolean;
  }[];
};

const posLabel = (pos: GridItemPosition | undefined) => {
  if (!pos) return '—';
  return `(${pos.col},${pos.row}) ${pos.colSpan}×${pos.rowSpan}`;
};

const posEq = (a: GridItemPosition | undefined, b: GridItemPosition | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
};

@Component({
  selector: 'et-sb-grid-real-world',
  template: `
    <div class="p-4 font-sans" style="color: rgb(var(--et-surface-color))">
      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <span
          class="px-2 py-1 rounded text-xs font-mono"
          style="background: rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color-muted))"
        >
          bp: <strong style="color: rgb(var(--et-surface-color))">{{ activeBreakpoint() }}</strong>
        </span>

        <button
          (click)="simulateApiReload()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer border border-transparent bg-blue-600 text-white"
        >
          Simulate API Reload
        </button>

        <button
          (click)="toggleLayoutTable()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer border"
          style="border-color: rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          {{ showLayoutTable() ? 'Hide' : 'Show' }} Layout Table
        </button>

        <button
          (click)="showApiPayload()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer border"
          style="border-color: rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Show API Payload
        </button>

        <button
          (click)="resetToInitial()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer border"
          style="border-color: rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color-muted))"
        >
          Reset
        </button>

        <button
          (click)="apiPayloadJson.set(null)"
          class="px-3 py-1.5 text-sm rounded cursor-pointer border"
          style="border-color: rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color-muted))"
        >
          Clear panels
        </button>
      </div>

      <et-grid
        #gridRef
        [breakpoints]="BREAKPOINTS"
        [rowHeight]="100"
        [gap]="16"
        [initialItems]="gridItems()"
        (layoutChange)="onLayoutChange($event)"
      >
        @for (item of gridItems(); track item.id) {
          <et-grid-item [itemId]="item.id" [ariaLabel]="item.type + ' widget'">
            <div
              class="text-[11px] uppercase tracking-wide"
              etGridItemDragHandle
              style="color: rgb(var(--et-surface-color-muted))"
            >
              ⠿ {{ item.type }}
            </div>
            <div class="flex flex-col justify-center h-full p-3 box-border gap-1">
              <div class="text-xs font-semibold" style="color: rgb(var(--et-surface-color))">
                {{ asData(item.data).title }}
              </div>
              <div
                class="text-[11px] px-1.5 py-0.5 rounded inline-block self-start font-mono"
                style="background: rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color-muted))"
              >
                {{ item.id }}
              </div>
            </div>
          </et-grid-item>
        }
      </et-grid>

      @if (showLayoutTable()) {
        <div class="mt-4 overflow-x-auto">
          <p class="text-[11px] mb-2" style="color: rgb(var(--et-surface-color-muted))">
            <strong>ext</strong> = gridItems() signal &nbsp;·&nbsp; <strong>int</strong> = grid.items() internal state
            &nbsp;·&nbsp; <span style="color: #ef4444">red = undefined</span> &nbsp;·&nbsp;
            <span style="color: #f59e0b">orange = ext ≠ int</span>
          </p>
          <table class="text-[11px] font-mono border-collapse" style="border: 1px solid rgb(var(--et-surface-border))">
            <thead>
              <tr style="background: rgb(var(--et-surface-border))">
                <th class="px-2 py-1 text-left" rowSpan="2">id</th>
                <th class="px-2 py-1 text-left" rowSpan="2">type</th>
                @for (bp of BREAKPOINT_NAMES; track bp) {
                  <th class="px-2 py-1 text-center" colspan="2">{{ bp }}</th>
                }
              </tr>
              <tr style="background: rgb(var(--et-surface-border))">
                @for (bp of BREAKPOINT_NAMES; track bp) {
                  <th class="px-2 py-1 text-center" style="font-weight: normal; opacity: .7">ext</th>
                  <th class="px-2 py-1 text-center" style="font-weight: normal; opacity: .7">int</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of layoutRows(); track row.id) {
                <tr style="border-top: 1px solid rgb(var(--et-surface-border))">
                  <td class="px-2 py-1">{{ row.id }}</td>
                  <td class="px-2 py-1" style="color: rgb(var(--et-surface-color-muted))">{{ row.type }}</td>
                  @for (bp of row.breakpoints; track bp.name) {
                    <td [style.color]="bp.extMissing ? '#ef4444' : 'inherit'" class="px-2 py-1 text-center">
                      {{ FORMAT_POS(bp.ext) }}
                    </td>
                    <td
                      [style.color]="bp.intMissing ? '#ef4444' : bp.mismatch ? '#f59e0b' : 'inherit'"
                      class="px-2 py-1 text-center"
                    >
                      {{ FORMAT_POS(bp.int) }}
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (apiPayloadJson()) {
        <div class="mt-4">
          <div class="text-[11px] uppercase tracking-wide mb-1" style="color: rgb(var(--et-surface-color-muted))">
            API payload — <code>adapter.toExternal(gridItems)</code>
          </div>
          <pre
            class="p-3 rounded text-[11px] overflow-auto max-h-64"
            style="background: rgb(var(--et-surface-background)); border: 1px solid rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color-muted))"
            >{{ apiPayloadJson() }}</pre
          >
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, GridItemComponent],
})
export class GridPartnerStorybookComponent {
  protected gridRef = viewChild<GridComponent>(GridComponent);

  public readonly BREAKPOINTS = [
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ];

  public readonly BREAKPOINT_NAMES = BREAKPOINT_NAMES;

  public readonly FORMAT_POS = posLabel;

  public activeBreakpoint = computed(() => this.gridRef()?.grid.activeBreakpoint() ?? '…');

  public gridItems = signal<GridItemConfig[]>(adapter.fromExternal(BACKEND_WIDGETS));
  public apiPayloadJson = signal<string | null>(null);
  public showLayoutTable = signal(false);

  public layoutRows = computed((): LayoutRow[] => {
    const items = this.gridItems();
    const internalItems = this.gridRef()?.grid.items() ?? [];
    const internalById = new Map(internalItems.map((i) => [i.id, i]));

    return items.map((item) => ({
      id: item.id,
      type: item.type,
      breakpoints: BREAKPOINT_NAMES.map((bp) => {
        const ext = item.layout[bp] as GridItemPosition | undefined;
        const int = internalById.get(item.id)?.layout[bp] as GridItemPosition | undefined;
        return {
          name: bp,
          ext,
          int,
          extMissing: !ext,
          intMissing: !int,
          mismatch: !posEq(ext, int),
        };
      }),
    }));
  });

  public asData(data: unknown): { title: string } {
    return data as { title: string };
  }

  public onLayoutChange(state: GridSerializedState) {
    this.gridItems.update((current) =>
      current.map((item) => {
        const updated = state.items.find((s) => s.id === item.id);
        return updated ? { ...item, layout: updated.layout } : item;
      }),
    );
  }

  public simulateApiReload() {
    const external = adapter.toExternal(this.gridItems());
    const reloaded = adapter.fromExternal(external);
    this.gridItems.set(reloaded);
    this.apiPayloadJson.set(JSON.stringify(external, null, 2));
  }

  public showApiPayload() {
    this.apiPayloadJson.set(JSON.stringify(adapter.toExternal(this.gridItems()), null, 2));
  }

  public toggleLayoutTable() {
    this.showLayoutTable.update((v) => !v);
  }

  public resetToInitial() {
    this.gridItems.set(adapter.fromExternal(BACKEND_WIDGETS));
    this.apiPayloadJson.set(null);
  }
}
