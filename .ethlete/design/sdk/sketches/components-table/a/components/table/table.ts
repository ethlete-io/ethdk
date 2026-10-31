import { table, tableStyles, TableColumnMock, TableMockOptions, TableRowMock } from '@ethlete/components/design/table';
import { definePart, drawing } from '@design-system';
import frame from './table.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  appearance?: TableMockOptions['appearance'];
  sort?: 'asc' | 'desc';
  header?: Interaction;
  row?: Interaction;
  cell?: 'focus-visible';
  selection?: boolean;
  expanded?: boolean;
  expander?: Interaction;
  groups?: boolean;
  cellError?: boolean;
  message?: 'empty' | 'error';
  loading?: boolean;
  busy?: boolean;
  longValue?: boolean;
  wide?: 'start' | 'scrolled';
  stickyHeader?: boolean;
};

const PLAYERS: [string, string, string, string][] = [
  ['Lena Hoffmann', 'FC Nordhafen', '14', '6'],
  ['Mara Jensen', 'SV Lindenau', '11', '9'],
  ['Ida Krüger', 'TSV Altmark', '9', '3'],
  ['Pia Schulte', 'FC Nordhafen', '7', '11'],
  ['Romy Wagner', 'SC Ostwall', '6', '2'],
  ['Nele Brandt', 'SV Lindenau', '5', '7'],
  ['Clara Vogt', 'TSV Altmark', '4', '4'],
  ['Hanna Peters', 'SC Ostwall', '3', '8'],
];

const LONG = 'Hoffmann-Wiesenthal-Brandenburger-Lindqvist-Oberhausen';

const columns = (sort: Props['sort'], header: Props['header']): TableColumnMock[] => [
  { header: 'Player', sortable: true, sort: sort ?? 'asc' },
  {
    header: 'Team',
    sortable: true,
    labelAttributes: header ? `data-et-force="${header}"` : undefined,
  },
  { header: 'Goals', sortable: true, align: 'end' },
  { header: 'Assists', align: 'end' },
];

const WIDE_HEADERS = ['Team', 'Goals', 'Assists', 'Shots', 'Minutes', 'Cards'];
const WIDE: string[][] = [
  ['FC Nordhafen', '14', '6', '41', '1 620', '2'],
  ['SV Lindenau', '11', '9', '36', '1 540', '1'],
  ['TSV Altmark', '9', '3', '30', '1 390', '4'],
  ['FC Nordhafen', '7', '11', '22', '1 480', '0'],
];

const wideTable = (scrolled: boolean) =>
  table({
    errorColor: 'danger',
    tracks: '140px 132px repeat(5, 96px)',
    columns: [
      { header: 'Player', sortable: true, sort: 'asc', sticky: scrolled ? { side: 'start', offset: 0 } : undefined },
      ...WIDE_HEADERS.map((header, index) => ({ header, align: index === 0 ? undefined : ('end' as const) })),
    ],
    rows: WIDE.map((cells, index) => ({ cells: [PLAYERS[index]?.[0] ?? '', ...cells] })),
    scrolled: scrolled ? { inlineStart: true, inlineEnd: true } : { inlineEnd: true },
    attributes: scrolled ? 'data-scrolled' : undefined,
  });

const rows = (props: Props): TableRowMock[] =>
  PLAYERS.slice(props.stickyHeader ? 3 : 0, props.stickyHeader ? 8 : 4).map((cells, index) => {
    const row: TableRowMock = { cells: [...cells] };

    if (props.longValue && index === 1) row.cells[0] = LONG;
    if (props.cellError && index === 1) {
      row.cells[2] = { value: '—', state: 'error', message: 'Goals could not be loaded' };
    }
    if (props.cell && index === 1) row.cells[1] = { value: cells[1], attributes: `data-et-force="${props.cell}"` };
    if (props.row && index === 1) row.attributes = `data-et-force="${props.row}"`;
    if (props.selection) row.selected = index === 1 || index === 2;
    if (props.expanded && index === 1) {
      row.detail = `<div class="t-detail"><span>Club since 2021</span><span>Left foot</span><span>2 hat-tricks this season</span></div>`;
    }
    if (props.expander && index === 1) row.expanderAttributes = `data-et-force="${props.expander}"`;
    if (props.expanded && index === 3) row.noExpander = true;

    return row;
  });

const render = (props: Props) => {
  if (props.wide) return wideTable(props.wide === 'scrolled');

  return table({
    errorColor: 'danger',
    tracks: 'minmax(0, 1.6fr) minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr)',
    appearance: props.appearance,
    columns: columns(props.sort, props.header),
    rows: rows(props),
    selection: props.selection ? 'mixed' : undefined,
    expandable: props.expanded || props.expander !== undefined,
    groups: props.groups ? [{ span: 2 }, { label: 'Season', span: 2 }] : undefined,
    message: props.message,
    placeholder: props.loading ? { rows: 4, widths: [70, 55, 30, 30] } : undefined,
    busyAt: props.busy ? 0.4 : undefined,
    interactive: props.row !== undefined,
    cellNavigation: props.cell !== undefined,
    scrolled: props.stickyHeader ? { blockStart: true } : undefined,
  });
};

export default definePart({
  note: "The SDK table (et-table), first drawing, drawn by its mock from @ethlete/components/design/table with its real markup and CSS: table.component.css plus the feature sheets for pinned columns, selection, expansion, group headers, the detail row and skeleton rows, and the checkbox, skeleton and icon CSS. Framed as a 480px page with 16px padding; the table is the default enclosed md one, 4 columns (Player sortable and sorted asc, Team sortable, Goals sortable end, Assists end), 4 rows. States: rest, sort-desc, header-hover, header-active, header-focus-visible (on the unsorted Team label), row-hover, row-active (a rowClick table), cell-focus-visible (etTableKeyboardNav), the appearances divided, zebra, grid, bare, selection (select-all mixed, rows 2 and 3 checked), selection-hover, expanded (expander column, row 2 open with its detail row, row 4 without an expander), expander-hover, expander-focus-visible, group-header (an unlabelled run over Player and Team, 'Season' over the counts), cell-error (the built-in mark), empty (default 'No data'), error (default icon and 'Could not load data'), loading (etTableSkeleton rows), busy (rows plus the busy bar), long-value (a 55-character unbroken name, ellipsis), wide-scroll (7 columns, 788px of tracks in a 448px host: end fade and end edge), sticky-column (Player pinned, scrolled: pin shadow at its edge, end fade), sticky-header (scrolled rows under the header with the block edge shadow). Static snapshot: the scroll in sticky-column comes from scroll-snap on the third header cell; sticky-header draws rows 4 to 8 with the scrolled-block-start class instead of a scrolled body. The skeleton shimmer and the busy sweep are drawn with animation none (sweep held at 0.4 of its run); the sort arrow fade, the detail reveal and the expander turn only run on a gesture and are drawn at rest. Numbers (light / dark), from shot pixels at scale 2, brand mint: body text 17.93 / 17.18; header text (muted) on the header band 7.17 / 6.23; header band vs row 1.09 / 1.11; row line vs row 1.26 / 1.73; table edge vs page 1.26 / 1.73; hover tint vs row 1.10 / 1.13; selected tint (12 %) vs row 1.06 / 1.31, selected hover 1.09 / 1.54, text on it 16.89 / 13.12; sort arrow (primary) vs header band 1.22 / 12.13; focus rings (primary, 2px inset) vs header band 1.22 / 12.13, cell ring vs row 1.33 / 13.50; checked checkbox fill vs row 1.25 / 10.31; busy sweep (primary) 1.22 / 12.13; cell error mark (danger ink) vs row 6.47 / 6.48. Q98 (edges and row lines vs page) numbers only: 1.26 / 1.73. Decided rules that arise: Q88 (focus rings), Q99a (sort arrow, busy sweep and the selected row on light; the checked checkbox is a mint fill, so it gets a 1px inset ink edge). Q101 does not arise: the core table draws no filled button. An ink edge arises, so Q102 arises: b draws the checkbox edge in dark too, c keeps dark as today. Lib finding, not a render refusal: the header label focus ring is a 2px outline at -2px offset on the sort button, whose box is exactly the label text (the label box's 4px padding is cancelled by its -4px margin), so the ring runs through the first glyph (see header-focus-visible in every variant). Later rounds, left out here: the column chooser, the column menu and its trigger, the filter triggers and their menus, the cell error tooltip, the cards appearance (row box styles), densities sm and lg, footer row and footer bar, multi-sort priorities, resize grips, reorder, inline edit, drag scroll, the page sticky header and virtual scroll.",
  madeBy: ['claude-opus-5-5'],
  states: {
    rest: {},
    'sort-desc': { sort: 'desc' },
    'header-hover': { header: 'hover' },
    'header-active': { header: 'active' },
    'header-focus-visible': { header: 'focus-visible' },
    'row-hover': { row: 'hover' },
    'row-active': { row: 'active' },
    'cell-focus-visible': { cell: 'focus-visible' },
    divided: { appearance: 'divided' },
    zebra: { appearance: 'zebra' },
    grid: { appearance: 'grid' },
    bare: { appearance: 'bare' },
    selection: { selection: true },
    'selection-hover': { selection: true, row: 'hover' },
    expanded: { expanded: true },
    'expander-hover': { expanded: true, expander: 'hover' },
    'expander-focus-visible': { expanded: true, expander: 'focus-visible' },
    'group-header': { groups: true },
    'cell-error': { cellError: true },
    empty: { message: 'empty' },
    error: { message: 'error' },
    loading: { loading: true },
    busy: { busy: true },
    'long-value': { longValue: true },
    'wide-scroll': { wide: 'start' },
    'sticky-column': { wide: 'scrolled' },
    'sticky-header': { stickyHeader: true },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${render(props)}</div>`,
      styles: [tableStyles, frame].join('\n'),
    }),
});
