import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GridComponent } from './grid.component';
import { GridItemConfig, GridItemPosition } from './headless/grid.types';

const posEq = (a: GridItemPosition | undefined, b: GridItemPosition | undefined) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.col === b.col && a.row === b.row && a.colSpan === b.colSpan && a.rowSpan === b.rowSpan;
};

/**
 * Development-only debug overlay for an `et-grid` instance.
 *
 * ```html
 * <et-grid #myGrid [initialItems]="items()" ...></et-grid>
 * <et-grid-debug [grid]="myGrid" [externalItems]="items()" />
 * ```
 *
 * Pass `externalItems` to detect divergence between the host signal
 * and the grid's internal itemConfigs. The **Copy JSON** button writes
 * a full diagnostic snapshot to the clipboard without any console output.
 */
@Component({
  selector: 'et-grid-debug',
  template: `
    <details
      style="font-family: monospace; font-size: 11px; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 8px; background: #f9fafb; color: #111"
    >
      <summary
        style="padding: 6px 10px; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; user-select: none"
      >
        <span style="font-weight: 700; color: #6b7280">et-grid-debug</span>

        <span style="color: #6b7280">
          bp: <strong style="color: #111827">{{ activeBreakpoint() }}</strong> &nbsp;·&nbsp; {{ containerWidth() }}px
          &nbsp;·&nbsp; {{ items().length }} items
          @if (hasDrag()) {
            &nbsp;·&nbsp; <span style="color: #d97706">⠿ dragging</span>
          }
        </span>

        @if (issueCount() > 0) {
          <span style="color: #dc2626; font-weight: 700"
            >⚠ {{ issueCount() }} issue{{ issueCount() === 1 ? '' : 's' }}</span
          >
        }

        <button
          (click)="copyJson($event)"
          style="margin-left: auto; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 3px; background: #fff; cursor: pointer; font-size: 11px; color: #374151"
        >
          Copy JSON
        </button>

        @if (copied()) {
          <span style="color: #16a34a; font-size: 10px">✓ copied</span>
        }
      </summary>

      <div style="padding: 8px 10px; overflow-x: auto; border-top: 1px solid #e5e7eb">
        <!-- Breakpoint legend -->
        <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap">
          @for (bp of breakpoints(); track bp.name) {
            <span
              [style.fontWeight]="bp.name === activeBreakpoint() ? '700' : '400'"
              [style.color]="bp.name === activeBreakpoint() ? '#1d4ed8' : '#9ca3af'"
              style="padding: 1px 7px; border: 1px solid currentColor; border-radius: 99px"
              >{{ bp.name }}&nbsp;{{ bp.columns }}col&nbsp;≥{{ bp.minWidth }}px</span
            >
          }
        </div>

        <!-- Layout table -->
        <table style="border-collapse: collapse; white-space: nowrap">
          <thead>
            <tr style="background: #f3f4f6">
              <th style="padding: 3px 8px; text-align: left; border: 1px solid #e5e7eb">id</th>
              <th style="padding: 3px 8px; text-align: left; border: 1px solid #e5e7eb">type</th>
              @for (bp of breakpoints(); track bp.name) {
                <th
                  [style.background]="bp.name === activeBreakpoint() ? '#dbeafe' : '#f3f4f6'"
                  style="padding: 3px 8px; text-align: center; border: 1px solid #e5e7eb"
                >
                  {{ bp.name }}{{ hasExternal() ? ' int' : '' }}
                </th>
                @if (hasExternal()) {
                  <th
                    [style.background]="bp.name === activeBreakpoint() ? '#dbeafe' : '#f3f4f6'"
                    style="padding: 3px 8px; text-align: center; border: 1px solid #e5e7eb; opacity: .65"
                  >
                    {{ bp.name }} ext
                  </th>
                }
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr>
                <td style="padding: 3px 8px; border: 1px solid #e5e7eb; color: #6b7280">{{ row.id }}</td>
                <td style="padding: 3px 8px; border: 1px solid #e5e7eb; color: #9ca3af">{{ row.type }}</td>
                @for (cell of row.cells; track cell.bp) {
                  <td
                    [style.color]="cell.intMissing ? '#dc2626' : '#111'"
                    [title]="cell.intMissing ? 'MISSING — layout.' + cell.bp + ' undefined in internal state' : ''"
                    style="padding: 3px 8px; border: 1px solid #e5e7eb; text-align: center"
                  >
                    {{ fmtPos(cell.int) }}
                  </td>
                  @if (hasExternal()) {
                    <td
                      [style.color]="cell.extMissing ? '#dc2626' : cell.mismatch ? '#d97706' : '#9ca3af'"
                      [title]="cell.mismatch ? 'MISMATCH — ext=' + fmtPos(cell.ext) + ' int=' + fmtPos(cell.int) : ''"
                      style="padding: 3px 8px; border: 1px solid #e5e7eb; text-align: center"
                    >
                      {{ fmtPos(cell.ext) }}
                    </td>
                  }
                }
              </tr>
            }
          </tbody>
        </table>

        @if (hasExternal()) {
          <p style="margin-top: 6px; color: #9ca3af; font-size: 10px">
            int = grid.items() (internal) &nbsp;·&nbsp; ext = externalItems input &nbsp;·&nbsp;
            <span style="color: #dc2626">red = undefined</span> &nbsp;·&nbsp;
            <span style="color: #d97706">orange = mismatch</span>
          </p>
        }
      </div>
    </details>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridDebugComponent {
  private destroyRef = inject(DestroyRef);

  public grid = input.required<GridComponent>();
  public externalItems = input<GridItemConfig[] | null>(null);

  public activeBreakpoint = computed(() => this.grid().grid.activeBreakpoint());
  public containerWidth = computed(() => this.grid().grid.containerWidth());
  public breakpoints = computed(() => this.grid().grid.breakpoints());
  public items = computed(() => this.grid().grid.items());
  public layout = computed(() => this.grid().grid.layout());
  public hasDrag = computed(() => this.grid().grid.dragState() !== null);
  public hasExternal = computed(() => this.externalItems() !== null);
  public copied = signal(false);

  public rows = computed(() => {
    const bps = this.breakpoints().map((b) => b.name);
    const internalItems = this.items();
    const external = this.externalItems();
    const extById = external ? new Map(external.map((i) => [i.id, i])) : null;

    return internalItems.map((item) => ({
      id: item.id,
      type: item.type,
      cells: bps.map((bp) => {
        const int = item.layout[bp] as GridItemPosition | undefined;
        const ext = extById?.get(item.id)?.layout[bp] as GridItemPosition | undefined;
        return {
          bp,
          int,
          ext,
          intMissing: !int,
          extMissing: extById !== null && !ext,
          mismatch: extById !== null && !posEq(int, ext),
        };
      }),
    }));
  });

  public issueCount = computed(() =>
    this.rows().reduce((n, row) => n + row.cells.filter((c) => c.intMissing || c.mismatch).length, 0),
  );

  public fmtPos(pos: GridItemPosition | undefined) {
    return pos ? `(${pos.col},${pos.row}) ${pos.colSpan}×${pos.rowSpan}` : '—';
  }

  public copyJson($event: Event) {
    $event.stopPropagation();

    const issues: { type: string; itemId: string; breakpoint: string }[] = [];
    for (const row of this.rows()) {
      for (const cell of row.cells) {
        if (cell.intMissing) issues.push({ type: 'missing-internal-layout', itemId: row.id, breakpoint: cell.bp });
        if (cell.mismatch) issues.push({ type: 'external-internal-mismatch', itemId: row.id, breakpoint: cell.bp });
      }
    }

    const external = this.externalItems();

    const snapshot = {
      timestamp: new Date().toISOString(),
      activeBreakpoint: this.activeBreakpoint(),
      containerWidth: this.containerWidth(),
      breakpoints: this.breakpoints(),
      internalItems: this.items().map((i) => ({ id: i.id, type: i.type, layout: i.layout })),
      activeLayout: this.layout(),
      ...(external ? { externalItems: external.map((i) => ({ id: i.id, type: i.type, layout: i.layout })) } : {}),
      issues,
    };

    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2)).catch(() => {
      /* clipboard unavailable in this context */
    });

    this.copied.set(true);
    timer(2000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tap(() => this.copied.set(false)),
      )
      .subscribe();
  }
}
