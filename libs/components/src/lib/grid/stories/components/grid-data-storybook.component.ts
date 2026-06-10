import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { GridItemComponent } from '../../grid-item.component';
import { GridComponent } from '../../grid.component';
import { createGridAdapter, fromGridPosition, toGridPosition } from '../../headless/grid-adapter';
import { GridItemConfig, GridSerializedState } from '../../headless/grid.types';

// ---------------------------------------------------------------------------
// Typed data contracts for each widget type
// ---------------------------------------------------------------------------

export type KpiData = {
  label: string;
  value: number;
  unit: string;
  delta: number;
};

export type ChartData = {
  title: string;
  points: number[];
  labels: string[];
};

export type NotesData = {
  title: string;
  body: string;
  author: string;
};

// ---------------------------------------------------------------------------
// Backend API shape — matches the WidgetView contract from the backend.
// In a real app this is what GET /partners/dashboards returns and what
// POST/PATCH /partners/dashboard expects.
// ---------------------------------------------------------------------------

type BreakpointLayout = { x: number; y: number; cols: number; rows: number };

type MockWidgetView = {
  uuid: string;
  type: string;
  layout: { sm: BreakpointLayout; md: BreakpointLayout; lg: BreakpointLayout };
  // In reality, widget-specific data is managed by separate PUT endpoints.
  // We inline it here to keep the demo self-contained.
  data: KpiData | ChartData | NotesData;
};

// ---------------------------------------------------------------------------
// Adapter — bridges MockWidgetView ↔ GridItemConfig.
// In a real app this lives next to the component that talks to the API.
// ---------------------------------------------------------------------------

const adapter = createGridAdapter<MockWidgetView>(
  (widget) => ({
    id: widget.uuid,
    type: widget.type,
    data: widget.data,
    layout: {
      sm: toGridPosition(widget.layout.sm),
      md: toGridPosition(widget.layout.md),
      lg: toGridPosition(widget.layout.lg),
    },
  }),
  (item) => ({
    uuid: item.id,
    type: item.type,
    layout: {
      sm: fromGridPosition(item.layout['sm'] ?? { col: 0, row: 0, colSpan: 2, rowSpan: 1 }),
      md: fromGridPosition(item.layout['md'] ?? { col: 0, row: 0, colSpan: 2, rowSpan: 1 }),
      lg: fromGridPosition(item.layout['lg'] ?? { col: 0, row: 0, colSpan: 3, rowSpan: 1 }),
    },
    data: item.data as KpiData | ChartData | NotesData,
  }),
);

// ---------------------------------------------------------------------------
// KPI widget
// ---------------------------------------------------------------------------

@Component({
  selector: 'et-sb-kpi-widget',
  template: `
    @let d = data();
    <div class="h-full flex flex-col justify-between p-4 box-border">
      <div class="text-[11px] uppercase tracking-wide font-medium" style="color: rgb(var(--et-surface-color-muted))">
        {{ d.label }}
      </div>
      <div>
        <div class="text-3xl font-bold" style="color: rgb(var(--et-surface-color))">
          {{ d.value | number: '1.0-0'
          }}<span class="text-base font-normal ml-1" style="color: rgb(var(--et-surface-color-muted))">{{
            d.unit
          }}</span>
        </div>
        <div [style.color]="d.delta >= 0 ? '#22c55e' : '#ef4444'" class="text-[12px] mt-1">
          {{ d.delta >= 0 ? '▲' : '▼' }} {{ d.delta | number: '1.1-1' }}% vs last period
        </div>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
})
export class KpiWidgetComponent {
  public data = input.required<KpiData>();
}

// ---------------------------------------------------------------------------
// Chart widget
// ---------------------------------------------------------------------------

@Component({
  selector: 'et-sb-chart-widget',
  template: `
    @let d = data();
    <div class="h-full flex flex-col p-3 box-border">
      <div class="text-sm font-semibold mb-2" style="color: rgb(var(--et-surface-color))">{{ d.title }}</div>
      <div class="flex-1 flex items-end gap-[3px]" style="min-height: 0">
        @for (pt of d.points; track $index) {
          <div
            [style.height.%]="pt"
            [style.min-height.px]="4"
            [style.background]="pt >= 70 ? '#3b82f6' : pt >= 40 ? '#60a5fa' : '#bfdbfe'"
            class="flex-1 rounded-t transition-all"
          ></div>
        }
      </div>
      <div class="flex justify-between mt-1 text-[10px]" style="color: rgb(var(--et-surface-color-muted))">
        @for (label of edgeLabels(); track $index) {
          <span>{{ label }}</span>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartWidgetComponent {
  public data = input.required<ChartData>();

  public edgeLabels = computed(() => {
    const labels = this.data().labels;
    if (labels.length <= 4) return labels;
    return [
      labels[0],
      labels[Math.floor(labels.length / 3)],
      labels[Math.floor((labels.length * 2) / 3)],
      labels[labels.length - 1],
    ];
  });
}

// ---------------------------------------------------------------------------
// Notes widget
// ---------------------------------------------------------------------------

@Component({
  selector: 'et-sb-notes-widget',
  template: `
    @let d = data();
    <div class="h-full flex flex-col p-3 box-border overflow-hidden">
      <div class="text-sm font-semibold mb-1" style="color: rgb(var(--et-surface-color))">{{ d.title }}</div>
      <div class="text-[11px] mb-2" style="color: rgb(var(--et-surface-color-muted))">by {{ d.author }}</div>
      <p
        class="text-[13px] leading-relaxed m-0 overflow-hidden"
        style="color: rgb(var(--et-surface-color)); display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical"
      >
        {{ d.body }}
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesWidgetComponent {
  public data = input.required<NotesData>();
}

// ---------------------------------------------------------------------------
// Initial grid items (internal GridItemConfig format)
// ---------------------------------------------------------------------------

const INITIAL_ITEMS: GridItemConfig[] = [
  {
    id: 'kpi-revenue',
    type: 'kpi',
    data: { label: 'Monthly Revenue', value: 128_450, unit: '$', delta: 12.3 } satisfies KpiData,
    layout: {
      lg: { col: 0, row: 0, colSpan: 3, rowSpan: 1 },
      md: { col: 0, row: 0, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'kpi-users',
    type: 'kpi',
    data: { label: 'Active Users', value: 24_891, unit: '', delta: -2.1 } satisfies KpiData,
    layout: {
      lg: { col: 3, row: 0, colSpan: 3, rowSpan: 1 },
      md: { col: 3, row: 0, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 1, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'kpi-orders',
    type: 'kpi',
    data: { label: 'Orders Today', value: 1_342, unit: '', delta: 8.7 } satisfies KpiData,
    layout: {
      lg: { col: 6, row: 0, colSpan: 3, rowSpan: 1 },
      md: { col: 0, row: 1, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 2, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'kpi-conversion',
    type: 'kpi',
    data: { label: 'Conversion Rate', value: 3.2, unit: '%', delta: 0.4 } satisfies KpiData,
    layout: {
      lg: { col: 9, row: 0, colSpan: 3, rowSpan: 1 },
      md: { col: 3, row: 1, colSpan: 3, rowSpan: 1 },
      sm: { col: 0, row: 3, colSpan: 2, rowSpan: 1 },
    },
  },
  {
    id: 'chart-sessions',
    type: 'chart',
    data: {
      title: 'Daily Sessions (last 14 days)',
      points: [55, 70, 45, 80, 65, 90, 75, 60, 85, 50, 78, 92, 68, 83],
      labels: ['1 Jun', '3 Jun', '6 Jun', '8 Jun', '10 Jun', '12 Jun', '14 Jun'],
    } satisfies ChartData,
    layout: {
      lg: { col: 0, row: 1, colSpan: 8, rowSpan: 2 },
      md: { col: 0, row: 2, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 4, colSpan: 2, rowSpan: 2 },
    },
  },
  {
    id: 'notes-q2',
    type: 'notes',
    data: {
      title: 'Q2 Highlights',
      author: 'Product Team',
      body: 'Strong growth in the EMEA region — up 18% QoQ. The new onboarding flow shipped in May is showing early conversion improvements. Key risk: churn in the SMB segment remains elevated. Next focus: retention campaign targeting 30-day inactive accounts.',
    } satisfies NotesData,
    layout: {
      lg: { col: 8, row: 1, colSpan: 4, rowSpan: 2 },
      md: { col: 0, row: 4, colSpan: 6, rowSpan: 2 },
      sm: { col: 0, row: 6, colSpan: 2, rowSpan: 2 },
    },
  },
];

const CONSTRAINTS: Record<string, { minColSpan: number; maxColSpan: number; minRowSpan: number; maxRowSpan: number }> =
  {
    kpi: { minColSpan: 2, maxColSpan: 4, minRowSpan: 1, maxRowSpan: 2 },
    chart: { minColSpan: 3, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
    notes: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
  };

const DEFAULT_CONSTRAINTS = { minColSpan: 1, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 };

// ---------------------------------------------------------------------------
// Storybook host component
// ---------------------------------------------------------------------------

@Component({
  selector: 'et-sb-grid-data',
  template: `
    <div class="p-4 font-sans" style="color: rgb(var(--et-surface-color))">
      <!-- Toolbar -->
      <div class="flex flex-wrap gap-2 mb-4 items-center">
        <span class="text-sm font-semibold mr-2" style="color: rgb(var(--et-surface-color))">Add widget:</span>
        @for (type of WIDGET_TYPES; track type) {
          <button
            (click)="addWidget(type)"
            class="px-3 py-1.5 text-sm rounded cursor-pointer capitalize"
            style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
          >
            + {{ type }}
          </button>
        }
        <button
          (click)="showApiPayload()"
          class="px-3 py-1.5 text-sm rounded cursor-pointer"
          style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
        >
          Show API Payload
        </button>
        @if (selectedId()) {
          <span class="ml-auto text-xs" style="color: rgb(var(--et-surface-color-muted))">
            Editing: <strong>{{ selectedId() }}</strong>
            <button (click)="selectedId.set(null)" class="ml-2 cursor-pointer underline">close</button>
          </span>
        }
      </div>

      <div class="flex gap-4" style="align-items: flex-start">
        <!-- Grid -->
        <div class="flex-1" style="min-width: 0">
          <et-grid
            [breakpoints]="breakpoints()"
            [rowHeight]="rowHeight()"
            [gap]="gap()"
            [initialItems]="gridItems()"
            (layoutChange)="onLayoutChange($event)"
          >
            @for (item of gridItems(); track item.id) {
              @let c = getConstraints(item.type);
              <et-grid-item
                [itemId]="item.id"
                [minColSpan]="c.minColSpan"
                [maxColSpan]="c.maxColSpan"
                [minRowSpan]="c.minRowSpan"
                [maxRowSpan]="c.maxRowSpan"
                [ariaLabel]="item.type + ' widget'"
              >
                <div
                  class="text-[11px] uppercase tracking-wide"
                  etGridItemDragHandle
                  style="color: rgb(var(--et-surface-color-muted))"
                >
                  ⠿ {{ item.type }}
                </div>

                <div class="flex gap-1" etGridItemAction>
                  <button
                    [style.color]="selectedId() === item.id ? '#3b82f6' : 'rgb(var(--et-surface-color-muted))'"
                    (click)="toggleEdit(item.id)"
                    class="size-5 flex items-center justify-center rounded text-xs cursor-pointer"
                    aria-label="Edit widget data"
                  >
                    ✎
                  </button>
                  <button
                    (click)="removeItem(item.id)"
                    class="size-5 flex items-center justify-center rounded text-xs cursor-pointer"
                    style="color: rgb(var(--et-surface-color-muted))"
                    aria-label="Remove widget"
                  >
                    ✕
                  </button>
                </div>

                @switch (item.type) {
                  @case ('kpi') {
                    <et-sb-kpi-widget [data]="asKpi(item.data)" />
                  }
                  @case ('chart') {
                    <et-sb-chart-widget [data]="asChart(item.data)" />
                  }
                  @case ('notes') {
                    <et-sb-notes-widget [data]="asNotes(item.data)" />
                  }
                }
              </et-grid-item>
            }
          </et-grid>
        </div>

        <!-- Inline data editor (shown when a widget is selected) -->
        @if (selectedItem()) {
          @let item = selectedItem()!;
          <div
            class="shrink-0 rounded p-4 text-sm"
            style="width: 260px; border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background))"
          >
            <div class="font-semibold mb-3 capitalize" style="color: rgb(var(--et-surface-color))">
              Edit {{ item.type }} data
            </div>

            @switch (item.type) {
              @case ('kpi') {
                @let d = asKpi(item.data);
                <label class="block mb-2">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Label</span>
                  <input
                    [value]="d.label"
                    (input)="updateKpi(item.id, { label: getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
                <label class="block mb-2">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Value</span>
                  <input
                    [value]="d.value"
                    (input)="updateKpi(item.id, { value: +getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    type="number"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
                <label class="block mb-2">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Unit</span>
                  <input
                    [value]="d.unit"
                    (input)="updateKpi(item.id, { unit: getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
                <label class="block">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Delta (%)</span>
                  <input
                    [value]="d.delta"
                    (input)="updateKpi(item.id, { delta: +getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    type="number"
                    step="0.1"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
              }

              @case ('notes') {
                @let d = asNotes(item.data);
                <label class="block mb-2">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Title</span>
                  <input
                    [value]="d.title"
                    (input)="updateNotes(item.id, { title: getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
                <label class="block mb-2">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Author</span>
                  <input
                    [value]="d.author"
                    (input)="updateNotes(item.id, { author: getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  />
                </label>
                <label class="block">
                  <span class="text-[11px] uppercase" style="color: rgb(var(--et-surface-color-muted))">Body</span>
                  <textarea
                    [value]="d.body"
                    (input)="updateNotes(item.id, { body: getInputValue($event) })"
                    class="block w-full mt-0.5 px-2 py-1 rounded text-sm box-border resize-none"
                    rows="6"
                    style="border: 1px solid rgb(var(--et-surface-border)); background: rgb(var(--et-surface-background)); color: rgb(var(--et-surface-color))"
                  ></textarea>
                </label>
              }

              @case ('chart') {
                <p class="text-[12px] m-0" style="color: rgb(var(--et-surface-color-muted))">
                  Chart data is generated automatically. In a real app this would connect to a data source.
                </p>
              }
            }
          </div>
        }
      </div>

      <!-- API payload panel — shows what adapter.toExternal() produces (the PATCH body) -->
      @if (apiPayloadJson()) {
        <div class="mt-4">
          <div class="text-[11px] uppercase tracking-wide mb-1" style="color: rgb(var(--et-surface-color-muted))">
            API payload — <code>adapter.toExternal(gridItems)</code> → sent as
            <code>PATCH /partners/dashboard/:uuid</code>
          </div>
          <pre
            class="p-3 rounded text-[11px] overflow-auto max-h-60"
            style="background: rgb(var(--et-surface-background)); border: 1px solid rgb(var(--et-surface-border)); color: rgb(var(--et-surface-color-muted))"
            >{{ apiPayloadJson() }}</pre
          >
        </div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, GridItemComponent, KpiWidgetComponent, ChartWidgetComponent, NotesWidgetComponent],
})
export class GridDataStorybookComponent {
  public rowHeight = input(110);
  public gap = input(16);
  public breakpoints = input([
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ]);

  public gridItems = signal<GridItemConfig[]>(INITIAL_ITEMS);
  public selectedId = signal<string | null>(null);
  public apiPayloadJson = signal<string | null>(null);

  public readonly WIDGET_TYPES = ['kpi', 'chart', 'notes'] as const;

  private nextIndex = INITIAL_ITEMS.length + 1;

  public selectedItem = computed(() => {
    const id = this.selectedId();
    return id ? (this.gridItems().find((i) => i.id === id) ?? null) : null;
  });

  public getConstraints(type: string) {
    return CONSTRAINTS[type] ?? DEFAULT_CONSTRAINTS;
  }

  // Safe casts — template-only, types are always correct by construction
  public asKpi(data: unknown): KpiData {
    return data as KpiData;
  }

  public asChart(data: unknown): ChartData {
    return data as ChartData;
  }

  public asNotes(data: unknown): NotesData {
    return data as NotesData;
  }

  public toggleEdit(id: string) {
    this.selectedId.update((prev) => (prev === id ? null : id));
  }

  // Keep gridItems in sync with positions after drag/resize/add/remove.
  // The grid emits the full updated layout; we merge new positions into our signal
  // while preserving each item's data (which the grid doesn't touch).
  public onLayoutChange(state: GridSerializedState) {
    this.gridItems.update((current) =>
      current.map((item) => {
        const updated = state.items.find((s) => s.id === item.id);
        return updated ? { ...item, layout: updated.layout } : item;
      }),
    );
  }

  // Converts current gridItems to the backend API format via the adapter and shows it.
  // This is the payload you would send to PATCH /partners/dashboard/:uuid.
  public showApiPayload() {
    this.apiPayloadJson.set(JSON.stringify(adapter.toExternal(this.gridItems()), null, 2));
  }

  public removeItem(id: string) {
    if (this.selectedId() === id) this.selectedId.set(null);
    this.gridItems.update((items) => items.filter((i) => i.id !== id));
  }

  public getInputValue(event: Event) {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  public updateKpi(id: string, patch: Partial<KpiData>) {
    this.gridItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, data: { ...(item.data as KpiData), ...patch } } : item)),
    );
  }

  public updateNotes(id: string, patch: Partial<NotesData>) {
    this.gridItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, data: { ...(item.data as NotesData), ...patch } } : item)),
    );
  }

  public addWidget(type: (typeof this.WIDGET_TYPES)[number]) {
    const id = `${type}-${this.nextIndex++}`;

    const defaultData: Record<string, unknown> = {
      kpi: { label: 'New Metric', value: 0, unit: '', delta: 0 } satisfies KpiData,
      chart: {
        title: 'New Chart',
        points: [40, 60, 55, 70, 65, 80, 75],
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      } satisfies ChartData,
      notes: { title: 'New Note', author: 'You', body: 'Write something here…' } satisfies NotesData,
    };

    // layout: {} — grid will auto-place the new item and emit layoutChange with its real position
    this.gridItems.update((items) => [...items, { id, type, data: defaultData[type], layout: {} }]);
  }
}
