import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { GridItemComponent } from '../../grid-item.component';
import { GridComponent } from '../../grid.component';
import { provideGridConfig } from '../../headless/grid-config';
import {
  GridComponentRegistration,
  GridItemConfig,
  GridItemMigration,
  GridItemMigrationStatus,
} from '../../headless/grid.types';
import { DummyChartComponent, DummyTableComponent, DummyTextComponent } from './dummy-components';

// ---------- Items at various versions to exercise all migration paths ----------

const MIGRATION_ITEMS: GridItemConfig[] = [
  {
    id: 'auto-chart',
    type: 'chart',
    version: 1, // auto-migrated to v2 (type renamed to 'chart-v2')
    data: undefined,
    layout: { lg: { col: 0, row: 0, colSpan: 6, rowSpan: 2 } },
  },
  {
    id: 'intervention-table',
    type: 'table',
    version: 1, // blocked — requires manual user action to reach v2
    data: undefined,
    layout: { lg: { col: 6, row: 0, colSpan: 6, rowSpan: 2 } },
  },
  {
    id: 'failed-widget',
    type: 'broken',
    version: 1, // migration throws — ends up in 'failed' state
    data: undefined,
    layout: { lg: { col: 0, row: 2, colSpan: 4, rowSpan: 2 } },
  },
  {
    id: 'current-text',
    type: 'text',
    version: 3, // already at latest — no migration runs
    data: undefined,
    layout: { lg: { col: 4, row: 2, colSpan: 4, rowSpan: 2 } },
  },
  {
    id: 'chained-kpi',
    type: 'kpi',
    version: 1, // two-step auto chain: v1 → v2 → v3
    data: undefined,
    layout: { lg: { col: 8, row: 2, colSpan: 4, rowSpan: 2 } },
  },
];

// ---------- Migrations (per-registration, no componentType needed) ----------

const chartMigrations: GridItemMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    requiresUserIntervention: false,
    migrate: (item) => ({ ...item, type: 'chart-v2' }),
  },
];

const tableMigrations: GridItemMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    requiresUserIntervention: true,
  },
];

const brokenMigrations: GridItemMigration[] = [
  {
    fromVersion: 1,
    toVersion: 2,
    requiresUserIntervention: false,
    migrate: () => {
      throw new Error('Migration failed: incompatible data format');
    },
  },
];

const kpiMigrations: GridItemMigration[] = [
  { fromVersion: 1, toVersion: 2, requiresUserIntervention: false, migrate: (item) => item },
  { fromVersion: 2, toVersion: 3, requiresUserIntervention: false, migrate: (item) => item },
];

// ---------- Registrations ----------

const REGISTRATIONS: GridComponentRegistration[] = [
  { component: DummyChartComponent, type: 'chart', version: 2, migrations: chartMigrations },
  { component: DummyTableComponent, type: 'table', version: 2, migrations: tableMigrations },
  { component: DummyChartComponent, type: 'broken', version: 2, migrations: brokenMigrations },
  { component: DummyTextComponent, type: 'text', version: 3 },
  { component: DummyChartComponent, type: 'kpi', version: 3, migrations: kpiMigrations },
];

// ---------- Component ----------

@Component({
  selector: 'et-sb-grid-migration',
  template: `
    <div class="p-4 font-sans" style="color: rgb(var(--et-surface-color))">
      <h2 class="text-base font-semibold mb-1" style="color: rgb(var(--et-surface-color))">Migration Scenarios</h2>
      <p class="text-xs mb-4" style="color: rgb(var(--et-surface-color-muted))">
        Each grid item was loaded from a persisted state at an older version. The grid runs configured migrations on
        startup and surfaces the result via
        <code>getMigrationStatus(id)</code>.
      </p>

      <!-- Grid comes first so #gridRef is initialized before the log reads it -->
      <et-grid
        #gridRef
        [breakpoints]="[{ name: 'lg', columns: 12, minWidth: 0 }]"
        [rowHeight]="120"
        [gap]="12"
        [initialItems]="ITEMS"
      >
        @let migratedItems = gridRef.grid.items();
        @for (item of ITEMS; track item.id) {
          @let status = gridRef.grid.getMigrationStatus(item.id);
          @let migratedItem = findMigratedItem(item.id, migratedItems);
          <et-grid-item [itemId]="item.id" [minColSpan]="2" [maxColSpan]="12" [minRowSpan]="1" [maxRowSpan]="6">
            <div
              class="text-xs uppercase tracking-wide"
              etGridItemDragHandle
              style="color: rgb(var(--et-surface-color-muted))"
            >
              ⠿ {{ item.id }}
            </div>

            <div class="flex flex-col items-start justify-center h-full gap-1 p-3">
              <!-- Status badge -->
              <span
                [style.background]="statusBadgeBg(status)"
                [style.color]="statusBadgeColor(status)"
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              >
                {{ status.state.toUpperCase() }}
              </span>

              <!-- Component type — strike-through original if renamed by migration -->
              <div class="text-xs mt-1" style="color: rgb(var(--et-surface-color))">
                @if (migratedItem && migratedItem.type !== item.type) {
                  <span style="text-decoration: line-through; color: rgb(var(--et-surface-color-muted))">{{
                    item.type
                  }}</span>
                  → <strong>{{ migratedItem.type }}</strong>
                } @else {
                  <strong>{{ item.type }}</strong>
                }
              </div>

              <!-- Version transition -->
              <div class="text-[11px]" style="color: rgb(var(--et-surface-color-muted))">
                @if (status.state === 'migrated') {
                  v{{ status.fromVersion }} → v{{ status.toVersion }}
                } @else if (status.state === 'needs-intervention') {
                  v{{ status.fromVersion }} → v{{ status.toVersion }} (manual)
                } @else if (status.state === 'failed') {
                  v{{ status.fromVersion }} — migration threw
                } @else {
                  v{{ item.version }} (current)
                }
              </div>
            </div>
          </et-grid-item>
        }
      </et-grid>

      <!-- Migration log — placed after <et-grid> so #gridRef is already set -->
      <div
        class="mt-4 rounded p-3 text-xs"
        style="background: rgb(var(--et-surface-background)); border: 1px solid rgb(var(--et-surface-border))"
      >
        <div class="font-semibold mb-2" style="color: rgb(var(--et-surface-color))">Migration log</div>
        @for (item of ITEMS; track item.id) {
          @let status = gridRef.grid.getMigrationStatus(item.id);
          <div class="flex items-start gap-2 py-1" style="border-top: 1px solid rgb(var(--et-surface-border) / 0.5)">
            <span [style.color]="statusColor(status)" class="font-mono shrink-0 w-4 text-center">{{
              statusIcon(status)
            }}</span>
            <span class="font-mono shrink-0" style="color: rgb(var(--et-surface-color-muted)); min-width: 160px">{{
              item.id
            }}</span>
            <span style="color: rgb(var(--et-surface-color))">{{ statusLabel(status, item) }}</span>
          </div>
        }
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridComponent, GridItemComponent],
  providers: [provideGridConfig({ registrations: REGISTRATIONS })],
})
export class GridMigrationStorybookComponent {
  public readonly ITEMS = MIGRATION_ITEMS;

  public findMigratedItem(id: string, migratedItems: GridItemConfig[]): GridItemConfig | undefined {
    return migratedItems.find((i) => i.id === id);
  }

  public statusIcon(status: GridItemMigrationStatus) {
    switch (status.state) {
      case 'ok':
        return '✓';
      case 'migrated':
        return '↑';
      case 'needs-intervention':
        return '⚠';
      case 'failed':
        return '✕';
    }
  }

  public statusColor(status: GridItemMigrationStatus) {
    switch (status.state) {
      case 'ok':
        return '#22c55e';
      case 'migrated':
        return '#3b82f6';
      case 'needs-intervention':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
    }
  }

  public statusLabel(status: GridItemMigrationStatus, item: GridItemConfig) {
    switch (status.state) {
      case 'ok':
        return `Already at v${item.version} — no migration needed`;
      case 'migrated':
        return `Auto-migrated v${status.fromVersion} → v${status.toVersion}`;
      case 'needs-intervention':
        return `Blocked at v${status.fromVersion}: upgrade to v${status.toVersion} requires manual action`;
      case 'failed':
        return `Migration from v${status.fromVersion} threw an error`;
    }
  }

  public statusBadgeBg(status: GridItemMigrationStatus) {
    switch (status.state) {
      case 'ok':
        return 'rgb(34 197 94 / 0.15)';
      case 'migrated':
        return 'rgb(59 130 246 / 0.15)';
      case 'needs-intervention':
        return 'rgb(245 158 11 / 0.15)';
      case 'failed':
        return 'rgb(239 68 68 / 0.15)';
    }
  }

  public statusBadgeColor(status: GridItemMigrationStatus) {
    switch (status.state) {
      case 'ok':
        return '#16a34a';
      case 'migrated':
        return '#2563eb';
      case 'needs-intervention':
        return '#d97706';
      case 'failed':
        return '#dc2626';
    }
  }
}
