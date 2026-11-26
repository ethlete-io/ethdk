import { table, tableStyles, TableColumnMock, TableMockOptions, TableRowMock } from '@ethlete/components/design/table';
import { definePart, drawing, interactionRows } from '@design-system';
import frame from './table.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Selection = 'some' | 'row-added' | 'row-removed' | 'all' | 'none';

type Props = {
  appearance?: TableMockOptions['appearance'];
  sort?: 'asc' | 'desc';
  header?: Interaction;
  row?: Interaction;
  cell?: 'focus-visible';
  selection?: Selection;
  expanded?: boolean;
  collapsed?: boolean;
  expander?: Interaction;
  checkbox?: Interaction;
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

const mark = (name: string) => `data-et-control="${name}" data-can-animate`;

const SORT = `${mark('sort-header')} data-et-action="emit:sortChange"`;

const action = (state: string, control: string) => `${mark(control)} data-et-action="${state}"`;

const forceOf = (interaction: Interaction | undefined) => (interaction ? ` data-et-force="${interaction}"` : '');

const SELECTED: Record<Selection, number[]> = {
  some: [1, 2],
  'row-added': [0, 1, 2],
  'row-removed': [2],
  all: [0, 1, 2, 3],
  none: [],
};

const selectAll = (selection: Selection): TableMockOptions['selection'] =>
  selection === 'all' ? 'checked' : selection === 'none' ? 'unchecked' : 'mixed';

const columns = (
  sort: Props['sort'],
  header: Props['header'],
  align: TableColumnMock['align'] = 'end',
): TableColumnMock[] => [
  { header: 'Player', sortable: true, sort: sort ?? 'asc', labelAttributes: SORT },
  {
    header: 'Team',
    sortable: true,
    labelAttributes: header ? `${SORT} data-et-force="${header}"` : SORT,
  },
  { header: 'Goals', sortable: true, align, labelAttributes: SORT },
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
      {
        header: 'Player',
        sortable: true,
        sort: 'asc',
        labelAttributes: SORT,
        sticky: scrolled ? { side: 'start', offset: 0 } : undefined,
      },
      ...WIDE_HEADERS.map((header, index) => ({ header, align: index === 0 ? undefined : ('end' as const) })),
    ],
    rows: WIDE.map((cells, index) => ({ cells: [PLAYERS[index]?.[0] ?? '', ...cells] })),
    scrolled: scrolled ? { inlineStart: true, inlineEnd: true } : { inlineEnd: true },
    attributes: scrolled ? 'data-scrolled' : undefined,
  });

const expandable = (props: Props) => props.expanded || props.collapsed || props.expander !== undefined;

const rows = (props: Props): TableRowMock[] =>
  PLAYERS.slice(props.stickyHeader ? 3 : 0, props.stickyHeader ? 8 : 4).map((cells, index) => {
    const row: TableRowMock = { cells: [...cells] };

    if (props.longValue && index === 1) row.cells[0] = LONG;
    if (props.cellError && index === 1) {
      row.cells[2] = { value: '—', state: 'error', message: 'Goals could not be loaded' };
    }
    if (props.cell && index === 1) row.cells[1] = { value: cells[1], attributes: `data-et-force="${props.cell}"` };
    if (props.row && index === 1) row.attributes = `data-et-force="${props.row}"`;
    if (props.selection) {
      row.selected = SELECTED[props.selection].includes(index);
      row.selectAttributes = `${action(row.selected ? 'selection-removed' : 'selection-added', 'select-checkbox')}${index === 1 ? forceOf(props.checkbox) : ''}`;
    }
    if (props.expanded && index === 1) {
      row.detail = `<div class="t-detail"><span>Club since 2021</span><span>Left foot</span><span>2 hat-tricks this season</span></div>`;
    }
    if (expandable(props)) {
      row.expanderAttributes = `${action(row.detail === undefined ? 'expanded' : 'collapsed', 'expander')}${index === 1 ? forceOf(props.expander) : ''}`;
    }
    if (expandable(props) && index === 3) row.noExpander = true;

    return row;
  });

const partOfCheckbox = (markup: string) =>
  markup.replaceAll('<div class="et-checkbox-box">', '<div data-et-control-part class="et-checkbox-box">');

const render = (props: Props) => {
  if (props.wide) return wideTable(props.wide === 'scrolled');

  return partOfCheckbox(
    table({
      errorColor: 'danger',
      tracks: 'minmax(0, 1.6fr) minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 0.8fr)',
      appearance: props.appearance,
      density: props.density,
      columns: columns(props.sort, props.header, props.center ? 'center' : undefined),
      rows: rows(props),
      selection: props.selection ? selectAll(props.selection) : undefined,
      selectAllAttributes: props.selection
        ? action(props.selection === 'all' ? 'selection-none' : 'selection-all', 'select-checkbox')
        : undefined,
      expandable: expandable(props),
      groups: props.groups ? [{ span: 2 }, { label: 'Season', span: 2 }] : undefined,
      message: props.message,
      placeholder: props.loading ? { rows: 4, widths: [70, 55, 30, 30] } : undefined,
      busyAt: props.busy ? 0.4 : undefined,
      interactive: props.row !== undefined,
      cellNavigation: props.cell !== undefined,
      scrolled: props.stickyHeader ? { blockStart: true } : undefined,
    }),
  );
};

const { states: interactionStates, grid } = interactionRows<
  Props,
  'sort-header' | 'select-checkbox' | 'expander',
  Interaction
>(
  {
    'sort-header': { sort: 'asc' },
    'select-checkbox': { selection: 'none' },
    expander: { expanded: true },
  },
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props, interaction) => ({
      ...props,
      ...(props.selection
        ? { checkbox: interaction }
        : props.expanded
          ? { expander: interaction }
          : { header: interaction }),
    }),
  },
);

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'design check'],
  states: {
    rest: {},
    ...interactionStates,
    'sort-desc': { sort: 'desc' },
    'row-hover': { row: 'hover' },
    'row-active': { row: 'active' },
    'cell-focus-visible': { cell: 'focus-visible' },
    divided: { appearance: 'divided' },
    zebra: { appearance: 'zebra' },
    grid: { appearance: 'grid' },
    bare: { appearance: 'bare' },
    selection: { selection: 'some' },
    'selection-hover': { selection: 'some', row: 'hover' },
    'selection-added': { selection: 'row-added' },
    'selection-removed': { selection: 'row-removed' },
    'selection-all': { selection: 'all' },
    'selection-none': { selection: 'none' },
    expanded: { expanded: true },
    collapsed: { collapsed: true },
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
  describe: {
    'sort-header':
      'The Team sort header at rest; check its label and arrow against the hover, pressed and focus looks.',
    'sort-header-hover': 'The Team header hovered; check that only the Team sort label shows hover.',
    'sort-header-active': 'The Team header pressed; check that the press look is deeper than hover.',
    'sort-header-focus-visible': 'The Team header focused by keyboard; check that the focus ring wraps its sort label.',
    'select-checkbox':
      'The second row checkbox at rest, unchecked; check its border against the hover, pressed and focus looks.',
    'select-checkbox-hover': 'The second row checkbox hovered; check its hover look.',
    'select-checkbox-active': 'The second row checkbox pressed; check that the press look goes past hover.',
    'select-checkbox-focus-visible': 'The second row checkbox focused by keyboard; check the ring around it.',
    expander: 'The second row expander at rest; check the chevron against the other looks.',
    'expander-hover': 'The second row expander hovered; check that only the expander button shows hover.',
    'expander-active': 'The second row expander pressed; check that the press look is deeper than hover.',
    'expander-focus-visible': 'The second row expander focused by keyboard; check that the ring wraps the expander.',
    rest: 'Four players sorted by Player ascending; check the header row, the sort arrow and the numbers aligned at the end.',
    'sort-desc': 'The players sorted by Player descending; check that the sort arrow flips.',
    'row-hover': 'An interactive table with the second row hovered; check that only that row tints.',
    'row-active': 'The second row pressed; check that the press tint is deeper than hover.',
    'cell-focus-visible': 'Cell navigation with the second Team cell focused; check that the ring wraps one cell.',
    divided: 'The divided appearance; check that lines separate the rows.',
    zebra: 'The zebra appearance; check that every other row takes a light stripe.',
    grid: 'The grid appearance; check that lines separate both rows and columns.',
    bare: 'The bare appearance; check that no row lines or stripes show.',
    selection: 'A selection column with two rows selected; check the mixed header checkbox and the selected row tint.',
    'selection-hover':
      'The selection table with the selected second row hovered; check that hover and selection both read.',
    'selection-added': 'Lena selected on top of the selection; check her checkbox and row tint, header still mixed.',
    'selection-removed': 'Mara cleared from the selection; only Ida stays selected and the header stays mixed.',
    'selection-all': 'Every row selected; check that the header checkbox is checked and all four rows tint.',
    'selection-none': 'No row selected; check that every checkbox, the header one too, is empty and no row tints.',
    expanded:
      'The second row expanded with its detail; check that the detail sits under the row and Pia has no expander.',
    collapsed: 'The expander column with every row collapsed; check the closed chevrons and that Pia has no expander.',
    'group-header': 'A Season group over Goals and Assists; check that the group label spans its two columns.',
    'cell-error': 'A failed Goals cell in the second row; check that the dash shows with the danger error mark.',
    empty: 'The table with the empty message; check that the message sits under the header.',
    error: 'The table with the error message; check that it reads as an error under the header.',
    loading: 'Four placeholder rows loading; check that skeleton bars fill the cells at varied widths.',
    busy: 'The table busy at 40 %; check the progress indicator and that the rows stay readable.',
    'long-value': 'A long name in the second row; check that it truncates or wraps inside its column.',
    'wide-scroll': 'A seven-column table at its start; check that it scrolls sideways with a shadow at the end edge.',
    'sticky-column': 'The wide table scrolled; check that Player sticks at the start with shadows on both edges.',
    'sticky-header': 'Five rows scrolled under a sticky header; check that the header stays on top with its shadow.',
    'density-sm': 'The table at density sm; check that rows are tighter but cells stay readable.',
    'density-lg': 'The table at density lg; check that rows are roomier with the same columns.',
    'align-center': 'Goals and Assists centered; check that numbers and headers sit in the middle of their columns.',
  },
  grid,
  controls: {
    'sort-header': { kind: 'button', input: ['pointer', 'keyboard'] },
    'select-checkbox': { kind: 'button', input: ['pointer', 'keyboard'] },
    expander: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  widths: [480],
  motions: {
    expand: { from: 'collapsed', to: 'expanded' },
    collapse: { from: 'expanded', to: 'collapsed' },
  },
  unreachable: [
    {
      from: 'rest',
      to: 'collapsed',
      reason: 'The collapsed table has an expander column the rest table lacks; no step adds or drops that column.',
    },
    {
      from: 'collapsed',
      to: 'rest',
      reason: 'The collapsed table has an expander column the rest table lacks; no step adds or drops that column.',
    },
    {
      from: 'loading',
      to: 'collapsed',
      reason: 'The loading table draws placeholder rows without an expander column; no step adds that column.',
    },
    {
      from: 'collapsed',
      to: 'loading',
      reason: 'The loading table draws placeholder rows without an expander column; no step drops that column.',
    },
    {
      from: 'busy',
      to: 'collapsed',
      reason: 'The busy table has no expander column, the collapsed one has; no step adds that column.',
    },
    {
      from: 'collapsed',
      to: 'busy',
      reason: 'The busy table has no expander column, the collapsed one has; no step drops that column.',
    },
  ],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  scrolls: ['wide-scroll', 'sticky-column'],
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [tableStyles, frame].join('\n'),
    }),
});
