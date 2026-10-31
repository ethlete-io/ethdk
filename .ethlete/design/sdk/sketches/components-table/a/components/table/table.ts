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
  density?: TableMockOptions['density'];
  center?: boolean;
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

const columns = (
  sort: Props['sort'],
  header: Props['header'],
  align: TableColumnMock['align'] = 'end',
): TableColumnMock[] => [
  { header: 'Player', sortable: true, sort: sort ?? 'asc' },
  {
    header: 'Team',
    sortable: true,
    labelAttributes: header ? `data-et-force="${header}"` : undefined,
  },
  { header: 'Goals', sortable: true, align },
  { header: 'Assists', align },
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
    density: props.density,
    columns: columns(props.sort, props.header, props.center ? 'center' : undefined),
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
  note: 'Decided rules only',
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
    'density-sm': { density: 'sm' },
    'density-lg': { density: 'lg' },
    'align-center': { center: true },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${render(props)}</div>`,
      styles: [tableStyles, frame].join('\n'),
    }),
});
