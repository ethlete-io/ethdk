import { ComponentFixture } from '@angular/core/testing';
import { pointerEvent, query, queryAll, tick } from '../../testing/driver-core';
import { fakeLayout, stackedChildren } from '../../testing/fake-layout';

const TABLE_HOST = '.et-table-host';
const HEADER_CELL = '.et-table-header-cell';
const COLUMN_HEADER_CELL = '.et-table-header-cell[data-col-key]';
const ROW = '.et-table-row';
const CELL = '.et-table-cell[data-col-key]';
const SORT_BUTTON = '.et-table-header-label--sortable';
const FILTER_TRIGGER = '.et-table-filter-trigger';
const POINTER_ID = 1;
const COLUMN_WIDTH = 200;

/** Which side of a column a drop lands on. */
export type TableDropSide = 'after' | 'before';

/** A reorder drag in progress - see {@link TableDriver.grabColumn}. */
export type TableColumnDrag = {
  /** Aborts the gesture the way the browser does (a system gesture, the tab backgrounding). */
  cancel: () => void;
  /** Releases the pointer where it stands, which is the drop the reorder commits. */
  drop: () => void;
  /** Drags to an absolute client x. */
  moveTo: (clientX: number) => void;
  /**
   * Drags onto `overKey`'s resting slot, past the point where the drop flips to `side`. Derived from
   * the faked column geometry, so a spec never spells out pixel positions.
   */
  moveOver: (overKey: string, side: TableDropSide) => void;
};

export type TableScrollExtent = {
  /** The scroll viewport's measured inline size. */
  viewportWidth: number;
  /** How wide the content inside it is; anything past `viewportWidth` is scrollable. */
  scrollWidth: number;
};

/**
 * Rows, cells and header queries for one `et-table`, plus the gestures its features are driven by.
 *
 * Every layout fake is installed by the call that needs it, never up front: the table measures its own
 * viewport to clamp a resized column, and a width faked from construction sends every spec that asserts
 * the unmeasured state down the measured branch instead.
 */
export const createTableDriver = (fixture: ComponentFixture<unknown>) => {
  const root = fixture.nativeElement as HTMLElement;
  const host = root.matches(TABLE_HOST) ? root : query(fixture, TABLE_HOST);

  if (!host) throw new Error('createTableDriver: the fixture renders no `et-table`.');

  let layoutIsFaked = false;

  const headerCells = () => queryAll(fixture, COLUMN_HEADER_CELL);
  const headerCell = (key: string) => query(fixture, `${HEADER_CELL}[data-col-key="${key}"]`);
  const rows = () => queryAll(fixture, ROW);
  const scroller = () => query(fixture, '.et-table-scroller') ?? host;

  const cellsOf = (rowIndex: number) => {
    const row = rows()[rowIndex];

    return row ? Array.from(row.querySelectorAll<HTMLElement>(CELL)) : [];
  };

  /**
   * Lays the header cells out in a row of equal-width columns. jsdom performs no layout, so a reorder
   * hit-tests every column against the same zero-width slot until this runs.
   */
  const fakeColumnLayout = () => {
    if (layoutIsFaked) return;

    layoutIsFaked = true;
    fakeLayout([
      stackedChildren(HEADER_CELL, COLUMN_WIDTH),
      // Read back off the offsets above rather than recomputed: the reorder preview measures widths by
      // client rect and resolves drop targets by offset, and the two disagreeing is not a real layout.
      { match: HEADER_CELL, rect: (element) => ({ left: (element as HTMLElement).offsetLeft, width: COLUMN_WIDTH }) },
    ]);
  };

  const restingBoundsOf = (key: string) => {
    fakeColumnLayout();

    const cell = headerCell(key);

    if (!cell) throw new Error(`createTableDriver: no header cell for column "${key}".`);

    return { start: cell.offsetLeft, end: cell.offsetLeft + cell.offsetWidth };
  };

  return {
    /** The `et-table` element itself. */
    host: () => host,
    /** The element the table scrolls in - its own host, unless a feature moved the body into a scroller. */
    scroller,

    query: <E extends Element = HTMLElement>(selector: string) => query<E>(fixture, selector),
    queryAll: <E extends Element = HTMLElement>(selector: string) => queryAll<E>(fixture, selector),

    headerCells,
    headerCell,
    /** The visible columns in render order, as the rendered header advertises them. */
    columnKeys: () => headerCells().map((cell) => cell.dataset['colKey'] ?? ''),
    ariaSort: (key: string) => headerCell(key)?.getAttribute('aria-sort') ?? null,

    rows,
    row: (rowIndex: number) => rows()[rowIndex] ?? null,
    cells: cellsOf,
    cell: (rowIndex: number, key: string) => cellsOf(rowIndex).find((cell) => cell.dataset['colKey'] === key) ?? null,
    /** Every row's cell texts, in render order - what the table actually shows. */
    rowTexts: () => rows().map((_, index) => cellsOf(index).map((cell) => cell.textContent?.trim() ?? '')),

    /** Sorts by clicking the column's header, the way a user does. */
    sortBy: (key: string) => {
      const button = query<HTMLButtonElement>(fixture, `${HEADER_CELL}[data-col-key="${key}"] ${SORT_BUTTON}`);

      if (!button) throw new Error(`createTableDriver: column "${key}" has no sort button.`);

      button.click();
      tick();
    },

    filterTrigger: (key?: string) =>
      query<HTMLButtonElement>(
        fixture,
        key ? `${HEADER_CELL}[data-col-key="${key}"] ${FILTER_TRIGGER}` : FILTER_TRIGGER,
      ),
    filterTriggers: () => queryAll<HTMLButtonElement>(fixture, FILTER_TRIGGER),

    /**
     * Hands the scroll viewport a size and a content size, so the table can tell it overflows.
     *
     * `clientWidth` comes from the shared layout fake; `scrollWidth` is defined on the element itself,
     * because the shared fake covers no scroll extent.
     */
    fakeScrollExtent: ({ scrollWidth, viewportWidth }: TableScrollExtent) => {
      Object.defineProperty(scroller(), 'scrollWidth', { configurable: true, value: scrollWidth });
      fakeLayout([{ match: (element) => element === scroller(), clientWidth: viewportWidth }]);
    },

    /**
     * Lets the table's own scroll position stick. jsdom never scrolls, so a written `scrollLeft` reads
     * back as 0 - and an auto-scroll loop stops on its first frame precisely when its write did not take.
     */
    makeScrollable: () => {
      let scrollLeft = 0;

      Object.defineProperty(scroller(), 'scrollLeft', {
        configurable: true,
        get: () => scrollLeft,
        set: (value: number) => void (scrollLeft = value),
      });
    },

    /**
     * Starts a reorder drag on a column's header, from the middle of its resting slot. The returned
     * drag has to travel before the gesture commits - a `pointerdown` alone reorders nothing.
     */
    grabColumn: (key: string): TableColumnDrag => {
      const bounds = restingBoundsOf(key);
      const cell = headerCell(key)!;
      const clientY = 10;

      pointerEvent(cell, 'pointerdown', {
        button: 0,
        clientX: (bounds.start + bounds.end) / 2,
        clientY,
        pointerId: POINTER_ID,
      });

      const moveTo = (clientX: number) =>
        pointerEvent(document, 'pointermove', { clientX, clientY, pointerId: POINTER_ID });
      let lastX = (bounds.start + bounds.end) / 2;

      return {
        moveTo: (clientX) => {
          lastX = clientX;
          moveTo(clientX);
        },
        moveOver: (overKey, side) => {
          const over = restingBoundsOf(overKey);
          const width = over.end - over.start;
          const middle = (over.start + over.end) / 2;

          // Past the midpoint by a quarter column - the reorder biases the flip away from the side it is
          // already showing, and a quarter column is the widest that bias ever gets.
          lastX = side === 'before' ? middle - width / 4 : middle + width / 4;
          moveTo(lastX);
        },
        drop: () => pointerEvent(document, 'pointerup', { clientX: lastX, clientY, pointerId: POINTER_ID }),
        cancel: () => pointerEvent(document, 'pointercancel', { clientX: lastX, clientY, pointerId: POINTER_ID }),
      };
    },
  };
};

export type TableDriver = ReturnType<typeof createTableDriver>;
