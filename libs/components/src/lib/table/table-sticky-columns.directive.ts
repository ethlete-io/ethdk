import { computed, Directive, effect, input, signal } from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';
import {
  injectTableFeatureHost,
  TableCellPinning,
  TableFeatureConfig,
  tableFeatureConfig,
} from './headless/table-features';

/**
 * Least horizontal room (px) the non-pinned columns must keep before pinning is suppressed: below this,
 * start+end pinned columns would cover the viewport and scrolling would reveal nothing.
 */
const MIN_UNPINNED_SPACE = 96;

/** Measured inline offsets (px) for pinned columns, keyed by column key. */
type StickyOffsets = { start: Record<string, number>; end: Record<string, number> };

const NO_PINNING: TableCellPinning = { stickyStart: false, stickyEnd: false, offsetStart: null, offsetEnd: null };

/** Options for {@link TableStickyColumnsDirective}. */
export type TableStickyColumnsConfig = TableFeatureConfig;

/**
 * Opt-in sticky columns for `et-table`: a column declaring `sticky: 'start' | 'end'` stays put while the
 * table scrolls horizontally, and the scroll fades move in to sit at the pinned column's inner edge.
 *
 * The offsets are measured, not declared - each pinned column stacks after the ones before it from its
 * own edge - so this runs a measurement whenever the host resizes or a column is resized. That is the
 * reason it is a feature: a table that pins nothing runs none of it, and never has the pinned cells'
 * chrome in the document either.
 *
 * @example
 * const COLUMNS = {
 *   name: { header: 'Name', value: (u: User) => u.name, width: '220px', sticky: 'start' },
 *   email: { header: 'Email', value: (u: User) => u.email, width: '280px' },
 * } satisfies TableColumns<User>;
 *
 * <et-table [data]="users()" [columns]="COLUMNS" etTableStickyColumns />
 */
@Directive({
  selector: '[etTableStickyColumns]',
  exportAs: 'etTableStickyColumns',
})
export class TableStickyColumnsDirective {
  private table = injectTableFeatureHost('etTableStickyColumns');

  /** See {@link TableStickyColumnsConfig}. */
  public config = input({} as TableStickyColumnsConfig, {
    alias: 'etTableStickyColumns',
    transform: tableFeatureConfig<TableStickyColumnsConfig>,
  });

  // The feature is a directive on the table, so its host *is* the table's element.
  private hostDimensions = signalHostElementDimensions();

  private offsets = signal<StickyOffsets>({ start: {}, end: {} });
  private leadOffsets = signal<Record<string, number>>({});
  private trailOffsets = signal<Record<string, number>>({});

  /**
   * True when pinning is measured to crowd the non-pinned columns off-screen. Pinning is then dropped so
   * every column scrolls normally instead of hiding behind the pins - which is what makes the same table
   * work on desktop and on a narrow viewport without a breakpoint of the consumer's own.
   */
  public suppressed = signal(false);

  private insets = signal({ start: 0, end: 0 });

  private enabled = computed(() => this.config().enabled ?? true);

  /** Whether any visible column is pinned to the inline-start edge (which also pins the lead columns). */
  public hasStickyStart = computed(
    () => !this.suppressed() && this.table.visibleColumnsMeta().some((column) => column.sticky === 'start'),
  );

  /** Whether any visible column is pinned to the trailing edge. */
  public hasStickyEnd = computed(
    () => !this.suppressed() && this.table.visibleColumnsMeta().some((column) => column.sticky === 'end'),
  );

  constructor() {
    const enabled = this.enabled;

    this.table.registerColumnPinning({
      cellPinning: (key) => this.cellPinning(key),
      leadPinning: (key) => this.leadPinning(key),
      trailPinning: (key) => this.trailPinning(key),
      insets: () => this.insets(),
      hasStickyEnd: () => this.hasStickyEnd(),
      enabled,
    });

    // Measure the pinned columns' inline offsets from the header cells' widths. Start pins stack from the
    // inline-start edge (clearing the lead columns), end pins from the trailing edge - pin from the edges,
    // so widths sum cleanly.
    effect(() => {
      if (!enabled()) return;

      this.hostDimensions();
      // Re-measure when a column is resized: the tracks change but the host's size does not.
      this.table.columnWidths();

      const columns = this.table.visibleColumnsMeta();
      const cells = this.table.headerCellElements();

      // `signalElementDimensions` observes one element; these offsets need the widths of *every* header
      // cell summed in order, re-read whenever the host resizes or a column width changes - both of which
      // this effect already tracks above.
      // eslint-disable-next-line ethlete/prefer-element-dimensions
      const width = (index: number) => cells[index]?.getBoundingClientRect().width ?? 0;

      const leadCells = this.table.leadHeaderCellElements();
      const leadOffsets: Record<string, number> = {};
      let leadWidth = 0;

      this.table.leadColumnsMeta().forEach((lead, index) => {
        leadOffsets[lead.key] = leadWidth;
        // Same as above: a running sum over all lead cells, not one observable element.
        // eslint-disable-next-line ethlete/prefer-element-dimensions
        leadWidth += leadCells[index]?.getBoundingClientRect().width ?? 0;
      });

      // The trailing utility columns stack from the trailing edge, so they are summed in reverse: the
      // last one sits at the edge and each one before it clears the ones after it.
      const trailCells = this.table.trailHeaderCellElements();
      const trailMeta = this.table.trailColumnsMeta();
      const trailOffsets: Record<string, number> = {};
      let trailWidth = 0;

      for (let index = trailMeta.length - 1; index >= 0; index--) {
        const trail = trailMeta[index];

        if (!trail) continue;

        trailOffsets[trail.key] = trailWidth;
        // Same as above: a running sum over all trailing cells, not one observable element.
        // eslint-disable-next-line ethlete/prefer-element-dimensions
        trailWidth += trailCells[index]?.getBoundingClientRect().width ?? 0;
      }

      const start: Record<string, number> = {};
      let left = leadWidth;
      let pinnedStartWidth = 0;
      let pinnedEndWidth = 0;
      let hasStartPin = false;

      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];

        if (column?.sticky === 'start') {
          start[column.key] = left;
          pinnedStartWidth += width(index);
          hasStartPin = true;
        }

        left += width(index);
      }

      const end: Record<string, number> = {};
      // The trailing utility columns own that edge, so an end-pinned data column stacks after them -
      // the mirror of `left` starting at the leading utility columns' width.
      let right = trailWidth;

      for (let index = columns.length - 1; index >= 0; index--) {
        const column = columns[index];

        if (column?.sticky === 'end') {
          end[column.key] = right;
          pinnedEndWidth += width(index);
        }

        right += width(index);
      }

      // Suppress pinning when the columns that would stay put (the pins, plus the lead columns when a
      // start pin makes them sticky too) leave the scrollable ones too little room to ever surface. Track
      // widths don't change when we unpin, so this can't oscillate.
      const containerWidth = this.hostDimensions()?.client?.width ?? 0;
      // A trailing utility column is pinned whenever pinning is live, so its width always counts here.
      const pinnedWidth = pinnedStartWidth + pinnedEndWidth + (hasStartPin ? leadWidth : 0) + trailWidth;
      const hasUnpinned = columns.some((column) => !column?.sticky);
      const suppressed = hasUnpinned && containerWidth > 0 && containerWidth - pinnedWidth < MIN_UNPINNED_SPACE;

      this.leadOffsets.set(leadOffsets);
      this.trailOffsets.set(trailOffsets);
      this.offsets.set({ start, end });
      this.suppressed.set(suppressed);
      this.insets.set(
        suppressed
          ? { start: 0, end: 0 }
          : { start: hasStartPin ? leadWidth + pinnedStartWidth : 0, end: pinnedEndWidth + trailWidth },
      );
    });
  }

  /** How a data column is pinned, as the table's header, body and footer cells render it. */
  public cellPinning(key: string): TableCellPinning {
    if (this.suppressed()) return NO_PINNING;

    const sticky = this.table.visibleColumnsMeta().find((column) => column.key === key)?.sticky ?? null;
    const offsets = this.offsets();

    return {
      stickyStart: sticky === 'start',
      stickyEnd: sticky === 'end',
      offsetStart: offsets.start[key] ?? null,
      offsetEnd: offsets.end[key] ?? null,
    };
  }

  /** Whether the leading utility columns are pinned along with a start-pinned column, and how far in. */
  public leadPinning(key: string) {
    const pinned = this.hasStickyStart();

    return { sticky: pinned, offset: pinned ? (this.leadOffsets()[key] ?? 0) : null };
  }

  /**
   * Whether the trailing utility columns are pinned to the trailing edge, and how far in. Unlike the
   * leading ones, these do not wait for a pinned data column: a feature puts its column at that edge to
   * keep it reachable, so pinning is live means pinned - see {@link TableLeadColumn.side}.
   */
  public trailPinning(key: string) {
    const pinned = this.enabled() && !this.suppressed();

    return { sticky: pinned, offset: pinned ? (this.trailOffsets()[key] ?? 0) : null };
  }
}
