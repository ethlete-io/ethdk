import { menu, type MenuMockRow, menuStyles } from '@ethlete/components/design/menu';
import { definePart, drawing, interactionRows } from '@design-system';
import edge from './menu.css?inline';

type ItemInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  rows: MenuMockRow[];
  forced?: ItemInteraction;
};

const MARK = 'data-et-control="item"';

const force = (interaction?: ItemInteraction) =>
  [MARK, interaction && `data-et-force="${interaction}"`].filter(Boolean).join(' ');

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

const withForced = (rows: MenuMockRow[], forced?: ItemInteraction): MenuMockRow[] =>
  rows.map((entry, index) =>
    index === 1 && 'label' in entry && entry.kind !== 'label'
      ? ({ ...entry, active: !!forced, attributes: force(forced) } as MenuMockRow)
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
  madeBy: ['claude-opus-5-5'],
  states: {
    menu: { rows: FULL },
    ...states,
    disabled: { rows: [row('Rename'), row('Export as PDF', { disabled: true }), row('Duplicate')] },
    'submenu-open': { rows: [row('Rename'), row('Move to', { submenu: 'open', active: true }), row('Duplicate')] },
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
