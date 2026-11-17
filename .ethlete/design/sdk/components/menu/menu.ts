import {
  menu,
  type MenuMockItem,
  type MenuMockRow,
  type MenuMockSelectionItem,
  menuStyles,
} from '@ethlete/components/design/menu';
import { definePart, drawing, interactionRows } from '@design-system';
import edge from './menu.css?inline';

type ItemInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  rows: MenuMockRow[];
  forced?: ItemInteraction;
};

const MARK = 'data-et-control="item"';

const row = (label: string, extra: Partial<Extract<MenuMockRow, { label: string }>> = {}) =>
  ({ label, attributes: MARK, ...extra }) as MenuMockRow;

const FULL: MenuMockRow[] = [
  { kind: 'label', label: 'Document' },
  row('Rename', { shortcut: 'F2' }),
  row('Duplicate', { shortcut: 'Ctrl D' }),
  row('Move to', { submenu: true }),
  row('Export as PDF', { disabled: true }),
  { kind: 'separator' },
  {
    kind: 'checkbox-group',
    label: 'Show',
    items: [
      { kind: 'checkbox', label: 'Comments', checked: true, attributes: MARK },
      { kind: 'checkbox', label: 'Suggestions', attributes: MARK },
    ],
  },
  { kind: 'separator' },
  {
    kind: 'radio-group',
    label: 'Sort by',
    items: [
      { kind: 'radio', label: 'Name', checked: true, attributes: MARK },
      { kind: 'radio', label: 'Date', attributes: MARK },
    ],
  },
  { kind: 'separator' },
  row('Delete', { destructive: true }),
];

const isItemRow = (entry: MenuMockRow): entry is MenuMockItem | MenuMockSelectionItem =>
  entry.kind === undefined || entry.kind === 'item' || entry.kind === 'checkbox' || entry.kind === 'radio';

const withForced = (rows: MenuMockRow[], forced?: ItemInteraction): MenuMockRow[] =>
  rows.map((entry, index) =>
    forced && index === 1 && isItemRow(entry)
      ? {
          ...entry,
          active: true,
          activeSource: forced === 'focus-visible' ? 'keyboard' : entry.activeSource,
          attributes: [entry.attributes, `data-et-force="${forced}"`].filter(Boolean).join(' '),
        }
      : entry,
  );

const { states, grid } = interactionRows(
  {
    item: { rows: [row('Rename'), row('Duplicate', { shortcut: 'Ctrl D' }), row('Move to', { submenu: true })] },
    checked: {
      rows: [
        { kind: 'checkbox', label: 'Suggestions', attributes: MARK },
        { kind: 'checkbox', label: 'Comments', checked: true, attributes: MARK },
        { kind: 'radio', label: 'Name', checked: true, attributes: MARK },
      ],
    },
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props: Props, interaction: ItemInteraction): Props => ({ ...props, forced: interaction }),
  },
);

export default definePart({
  note: 'Decided rules only',
  consumerAction: 'its items are actions the consumer passes in',
  madeBy: ['claude-opus-5-5'],
  states: {
    menu: { rows: FULL },
    ...states,
    disabled: { rows: [row('Rename'), row('Export as PDF', { disabled: true }), row('Duplicate')] },
    'submenu-open': { rows: [row('Rename'), row('Move to', { submenu: 'open', active: true }), row('Duplicate')] },
  },
  describe: {
    menu: 'The full menu with label, shortcuts, submenu, disabled, checkbox and radio groups and Delete; check alignment and separators.',
    item: 'Three plain items, one with a shortcut, one with a submenu arrow; check that shortcuts and arrow align on the right.',
    'item-hover': 'The items with Duplicate hovered; check that only that row takes the hover tint.',
    'item-active': 'The items with Duplicate pressed; check that the pressed tint is deeper than hover.',
    'item-focus-visible':
      'The items with Duplicate focused by keyboard; check that the row shows the keyboard focus look.',
    checked:
      'A checkbox off, a checkbox on and a checked radio; check that the check and dot marks sit in the leading slot.',
    'checked-hover': 'The checked row hovered; check that the tint shows and the check mark stays visible.',
    'checked-active': 'The checked row pressed; check that the pressed tint keeps the check mark readable.',
    'checked-focus-visible':
      'The checked row focused by keyboard; check that focus shows without hiding the check mark.',
    disabled: 'Export as PDF disabled between two items; check that it fades and its neighbours stay full.',
    'submenu-open': 'Move to with its submenu open; check that the row stays highlighted as the open parent.',
  },
  grid,
  widths: [480],
  controls: {
    item: { kind: 'row', input: ['pointer', 'keyboard'], disabled: true },
  },
  frame: (body) => `<div class="menu-frame">${body}</div>`,
  render: ({ rows, forced }: Props) =>
    drawing({
      body: menu({ rows: withForced(rows, forced), color: 'brand' }),
      styles: [menuStyles, edge].join('\n'),
    }),
});
