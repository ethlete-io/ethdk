import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TableStorybookComponent } from './table-storybook.component';

export default {
  title: 'Components/Data display/Table',
  component: TableStorybookComponent,
  decorators: [moduleMetadata({ imports: [TableStorybookComponent] })],
  args: {
    rowCount: 6,
    appearance: 'enclosed',
    density: 'md',
    constrainHeight: false,
    empty: false,
    multiSort: false,
    expandable: false,
    subTable: false,
    loading: false,
    failed: false,
    cellStates: false,
    singleSelectFilter: false,
    richFilterOptions: false,
    reorderable: false,
    virtualScroll: false,
    grouped: false,
    stickyColumns: false,
    dragScroll: false,
    pageStickyHeader: false,
    footer: false,
    paginated: false,
    rowInteractive: false,
    rowLinks: false,
    resizableColumns: false,
    columnMenu: false,
    disabledColumns: false,
    selectable: false,
    selectionSide: 'start',
    csvExport: false,
    keyboardNav: false,
    inlineEdit: false,
    serverPaged: false,
    surface: 'dark',
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    appearance: { control: 'inline-radio', options: ['enclosed', 'divided', 'zebra', 'grid', 'bare', 'cards'] },
    density: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    constrainHeight: { control: 'boolean' },
    empty: { control: 'boolean' },
    multiSort: { control: 'boolean' },
    expandable: { control: 'boolean' },
    subTable: { control: 'boolean' },
    loading: { control: 'boolean' },
    failed: { control: 'boolean' },
    cellStates: { control: 'boolean' },
    singleSelectFilter: { control: 'boolean' },
    richFilterOptions: { control: 'boolean' },
    reorderable: { control: 'boolean' },
    virtualScroll: { control: 'boolean' },
    grouped: { control: 'boolean' },
    stickyColumns: { control: 'boolean' },
    dragScroll: { control: 'boolean' },
    pageStickyHeader: { control: 'boolean' },
    footer: { control: 'boolean' },
    paginated: { control: 'boolean' },
    rowInteractive: { control: 'boolean' },
    rowLinks: { control: 'boolean' },
    resizableColumns: { control: 'boolean' },
    columnMenu: { control: 'boolean' },
    disabledColumns: { control: 'boolean' },
    selectable: { control: 'boolean' },
    selectionSide: { control: 'inline-radio', options: ['start', 'end'] },
    csvExport: { control: 'boolean' },
    keyboardNav: { control: 'boolean' },
    inlineEdit: { control: 'boolean' },
    serverPaged: { control: 'boolean' },
    surface: { control: 'text' },
  },
} as Meta<TableStorybookComponent>;

type Story = StoryObj<TableStorybookComponent>;

export const Default: Story = {};

export const Appearance: Story = {
  args: { appearance: 'zebra' },
  parameters: {
    docs: {
      description: {
        story:
          'The `appearance` input picks the frame: `enclosed` (default, bordered rounded panel), `divided`, ' +
          '`zebra`, `grid`, `bare`, or `cards` (every row a card of its own). Switch it in the controls to compare.',
      },
    },
  },
};

export const Density: Story = {
  args: { density: 'sm' },
  parameters: {
    docs: {
      description: { story: '`density` sets the cell padding: `sm` (tight), `md` (default), `lg` (roomy).' },
    },
  },
};

export const MultiSort: Story = {
  args: { multiSort: true },
  parameters: {
    docs: {
      description: {
        story: 'With `multiSort`, clicking successive headers layers sorts; each header cycles asc → desc → off.',
      },
    },
  },
};

export const StickyHeader: Story = {
  args: { rowCount: 40, constrainHeight: true },
  parameters: {
    docs: {
      description: {
        story: 'A height-constrained table scrolls its body while the header stays pinned (`position: sticky`).',
      },
    },
  },
};

export const PageStickyHeader: Story = {
  args: {
    rowCount: 40,
    pageStickyHeader: true,
    grouped: true,
    stickyColumns: true,
    resizableColumns: true,
    columnMenu: true,
    reorderable: true,
    dragScroll: true,
    keyboardNav: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'An unbounded table pins its header to the page while its body remains horizontally scrollable.',
      },
    },
  },
};

export const Empty: Story = {
  args: { empty: true },
};

export const Loading: Story = {
  args: { loading: true, rowCount: 0 },
  parameters: {
    docs: {
      description: {
        story:
          '`loading` with nothing to show yet fills the body with placeholder rows - one per column, so ' +
          'the layout does not jump when the data lands. `loadingRows` sets how many; the host carries ' +
          '`aria-busy` and the rows themselves are hidden from assistive tech.',
      },
    },
  },
};

export const Refetching: Story = {
  args: { loading: true },
  parameters: {
    docs: {
      description: {
        story:
          'The same `loading` input over rows that are already on screen keeps them readable and runs an ' +
          'indeterminate bar under the header instead - the state a paged or refetching table is in most ' +
          'of the time, where blanking the body would cost the user their place.',
      },
    },
  },
};

export const Errored: Story = {
  args: { failed: true },
  parameters: {
    docs: {
      description: {
        story:
          'Anything non-nullish in `error` replaces the body with the error state, so stale rows never sit ' +
          'under an unreported failure. `errorLabel` is the default text; project `[etTableError]` for ' +
          'more (the message, a retry button). The mark takes the app’s error color theme.',
      },
    },
  },
};

export const CellStates: Story = {
  args: { cellStates: true },
  parameters: {
    docs: {
      description: {
        story:
          "`cellState` gives a single cell its own async state, for inline editing: `'loading'` swaps that " +
          "cell’s value for a placeholder bar (here row 2’s email, mid-save) and `'error'` keeps the value " +
          'and marks it in the error color (row 4’s role). The rest of the row stays live.',
      },
    },
  },
};

export const Expandable: Story = {
  args: { expandable: true },
  parameters: {
    docs: {
      description: {
        story: 'Rows expand to a lazily-instantiated detail row (nest another `<et-table>` here for sub-tables).',
      },
    },
  },
};

export const ExpandableSubTable: Story = {
  args: { expandable: true, subTable: true, rowCount: 5 },
  parameters: {
    docs: {
      description: {
        story:
          'The detail template can hold anything, including another `<et-table>` - a sub-table needs no ' +
          'dedicated API. The nested table carries its own `columns`, `rowKey`, sorting and empty state, and ' +
          'sits on `etAutoSurface` so it paints one elevation above the table it is nested in.',
      },
    },
  },
};

export const SingleSelectFilter: Story = {
  args: { singleSelectFilter: true },
  parameters: {
    docs: {
      description: {
        story:
          "A column with `filterSelection: 'single'` filters by one value: the menu renders radio items " +
          'instead of checkboxes, picking replaces the selection, and picking the selected one again ' +
          'clears the filter. Filter state stays a list of values either way, so nothing downstream ' +
          'changes - `state()`, client filtering and a server request all look the same.',
      },
    },
  },
};

export const TemplatedFilterOptions: Story = {
  args: { richFilterOptions: true },
  parameters: {
    docs: {
      description: {
        story:
          '`etTableFilterOption` templates one column’s option rows - a subtitle here, a flag or avatar ' +
          'elsewhere. `let-option` is the option and `let-selected` whether it is picked; the menu still ' +
          'owns the row, its checkbox mark and its keyboard behaviour.',
      },
    },
  },
};

export const Reorderable: Story = {
  args: { reorderable: true },
  parameters: {
    docs: {
      description: {
        story:
          'Drop `<et-table-reorder />` (from `TABLE_REORDER_IMPORTS`) inside the table and a column header ' +
          'can be dragged sideways to reorder columns.',
      },
    },
  },
};

export const GroupedHeaders: Story = {
  args: { grouped: true },
  parameters: {
    docs: {
      description: {
        story:
          'Columns sharing a `group` render beneath one spanning label in a second header row; each ' +
          'sub-column stays independently sortable. Ungrouped columns (Name) span both header rows.',
      },
    },
  },
};

export const StickyColumns: Story = {
  args: { stickyColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          'Give columns `sticky: "start"` / `"end"` to pin them while the table scrolls horizontally. ' +
          'Here Name pins left and Joined pins right; scroll sideways to see the middle columns pass behind.',
      },
    },
  },
};

export const DragScroll: Story = {
  args: { dragScroll: true, stickyColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          '`etTableDragScroll` pans the table by dragging anywhere in it, so a wide table is reachable ' +
          'without the scrollbar. A press that does not travel is still a click, so rows and header ' +
          'controls behave as they did; a drag swallows the click it would have ended on.',
      },
    },
  },
};

export const Selectable: Story = {
  args: { selectable: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `selectable`, a leading checkbox column drives a two-way `selection` set of row keys; the ' +
          'header checkbox selects/clears all rows (indeterminate when only some are selected).',
      },
    },
  },
};

export const SelectableAtTheTrailingEdge: Story = {
  args: { selectable: true, selectionSide: 'end', stickyColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `side: "end"` the checkbox column ends every row instead of starting it. It pins to that ' +
          'edge as soon as `etTableStickyColumns` is on - scroll sideways and the checkboxes stay put, ' +
          'since a column moved there is a column meant to stay reachable.',
      },
    },
  },
};

export const StickyFooter: Story = {
  args: { footer: true, constrainHeight: true, rowCount: 40 },
  parameters: {
    docs: {
      description: {
        story:
          'A column `footerCell` (context: the rendered rows) adds a summary row pinned to the bottom of ' +
          'the scroll viewport - here a running count in the Name column.',
      },
    },
  },
};

export const ColumnMenu: Story = {
  args: { columnMenu: true, resizableColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `etTableColumnMenu` (from `TABLE_COLUMN_MENU_IMPORTS`) every header grows a `\u22ee` ' +
          'holding that column\u2019s actions: sort ascending / descending / clear, reset a resized width ' +
          '(offered only once the column has actually been resized), and hide the column (never the last ' +
          'visible one). Sorting itself stays on the header \u2014 click it to cycle, and the arrow beside ' +
          'the label shows the direction it is sorted by.',
      },
    },
  },
};

export const DisabledColumns: Story = {
  args: { disabledColumns: true, columnMenu: true },
  parameters: {
    docs: {
      description: {
        story:
          'A column marked `disabled` turns off its own header controls: its sortable header, its ' +
          'filter menu and its column menu all render disabled, and the label dims with them. Email is ' +
          'sortable and Role is filterable, so both are shown here. The cells keep their full weight \u2014 ' +
          'the values are still real \u2014 and a sort or filter the column already carries stays applied; ' +
          'only the controls that would change it are off. Resizing and hiding stay available, being ' +
          'width and layout gestures rather than column controls.',
      },
    },
  },
};

export const ResizableColumns: Story = {
  args: { resizableColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `<et-table-resize />` (from `TABLE_RESIZE_IMPORTS`) each header grows a grip on its ' +
          'trailing edge - drag it to resize the ' +
          'column, double-click to reset to the default width. Widths persist in `state()` and round-trip ' +
          'through `restoreState()`. Composes with reordering: the grip swallows its own pointerdown so it ' +
          'never starts a header drag.',
      },
    },
  },
};

export const ReorderableAndResizable: Story = {
  args: { reorderable: true, resizableColumns: true },
  parameters: {
    docs: {
      description: {
        story:
          'Both features are opt-in components inside the table (`<et-table-reorder />` + ' +
          '`<et-table-resize />`) and compose: drag a header body to move the column, or grab its trailing grip ' +
          'to resize it. The grip swallows its own pointerdown so it never starts a reorder, and resized ' +
          'widths are keyed by column, so they travel with the column when it moves. On touch the grip has an ' +
          'enlarged hit area.',
      },
    },
  },
};

export const RowInteractive: Story = {
  args: { rowInteractive: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `rowInteractive`, rows get a pointer affordance and emit `(rowClick)` with the row - except ' +
          'when the click lands on interactive cell content (a button, link, input, the selection checkbox, ' +
          'or the expander), which keeps those controls working. The table performs no navigation itself; ' +
          'wire `router.navigate` in the handler. Click a row to update the readout below.',
      },
    },
  },
};

export const RowLinks: Story = {
  args: { rowLinks: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `rowLink`, every row is a real `<a href>` stretched over the row: middle click, Ctrl/Cmd-click, ' +
          '"open in a new tab" and "copy link address" all work, and the row is one link in the accessibility ' +
          'tree and one stop in the tab order. The Joined column declares `interactive: true`, so its button ' +
          'keeps its own clicks. Answer with router commands and add `etTableRowRouterLink` for in-app routing.',
      },
    },
  },
};

export const CardRows: Story = {
  args: { appearance: 'cards', rowLinks: true },
  parameters: {
    docs: {
      description: {
        story:
          'The `cards` appearance gives every row a box of its own - a rounded card on a surface one ' +
          "elevation above the table's, spaced by " +
          '`--et-table-row-gap` and rounded by `--et-table-row-radius`. The columns still line up with the ' +
          "header, because the row is a `subgrid` of the table's own tracks.",
      },
    },
  },
};

export const PaginatedFooter: Story = {
  args: { paginated: true },
  parameters: {
    docs: {
      description: {
        story:
          'The `[etTableFooter]` slot projects arbitrary controls into a full-width bar pinned to the bottom ' +
          'of the table. The table bakes in no pager - here a page-size `<et-select>` and an `<et-pagination>` ' +
          'drive a client-side page slice; wire them to `tableRowsFromQuery` for server paging.',
      },
    },
  },
};

export const Virtualized: Story = {
  args: { virtualScroll: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `virtualScroll`, the table becomes its own scroll container and renders only the rows near ' +
          'the viewport - here 2,000 rows scroll smoothly with a handful in the DOM. Give the table a bounded height.',
      },
    },
  },
};

export const CsvExport: Story = {
  args: { csvExport: true, selectable: true },
  parameters: {
    docs: {
      description: {
        story:
          'The `etTableCsvExport` directive downloads the table as CSV from a button of your own. It writes the ' +
          "visible columns in their displayed order and the table's own rows (client-filtered and sorted), so " +
          'filtering, sorting, hiding or reordering a column changes the file. `export()` takes overrides - the ' +
          'second button passes `rows: selection.selectedRows()` to export only what is ticked.',
      },
    },
  },
};

export const CsvExportBeyondThePage: Story = {
  args: { csvExport: true, serverPaged: true },
  parameters: {
    docs: {
      description: {
        story:
          'A server-paginated table holds one page, so an export that says nothing would write a plausible, ' +
          'wrong file. When the table’s `rowsSource` reports a `total`, the export notices and throws `ET3506` ' +
          'in dev mode instead. The two buttons are the two honest answers: `rows: tableCsvRowsFromPages(…)` ' +
          'walks every page before writing (with `exporting()` driving the busy state), and `partial: true` ' +
          'writes the loaded page on purpose. A backend with its own export endpoint skips both - pass its ' +
          'query, promise or observable as `file` and the server’s CSV is saved as it came.',
      },
    },
  },
};

export const KeyboardNavigation: Story = {
  args: { keyboardNav: true, rowCount: 12, columnMenu: true },
  parameters: {
    docs: {
      description: {
        story:
          '`etTableKeyboardNav` makes the body a single tab stop and moves cell focus with the arrows, ' +
          'Home/End, Ctrl+Home/End and PageUp/PageDown - the ARIA grid pattern. Tab into the table, then ' +
          'navigate; Enter drills into a cell that holds a control and Escape comes back out.',
      },
    },
  },
};

export const InlineEditing: Story = {
  args: { inlineEdit: true, rowCount: 6 },
  parameters: {
    docs: {
      description: {
        story:
          '`etTableInlineEdit` swaps an `editable` column’s cell for the `etTableCellEdit` template while it is ' +
          'being edited. Double-click a Name or Email cell, or focus one and press Enter; Enter saves, Escape ' +
          'restores, Tab saves and moves to the next cell in the row. The editor is a plain `et-input` bound with ' +
          '`[formField]` to the draft the feature hands the template - there is no cell-editor interface. ' +
          'Committing only *reports* the change: this demo runs a pretend request and reports its progress back ' +
          'through the table’s `cellState`, which is what draws the pending bar and the error mark. Type `fail` ' +
          'into a cell to see the failure path.',
      },
    },
  },
};

export const VirtualizedKeyboardNavigation: Story = {
  args: { keyboardNav: true, virtualScroll: true },
  parameters: {
    docs: {
      description: {
        story:
          'Navigation composes with virtualization: pressing ArrowDown (or PageDown, or Ctrl+End) past the ' +
          'rendered window asks the window to scroll the target row in, then focuses it once it exists.',
      },
    },
  },
};
