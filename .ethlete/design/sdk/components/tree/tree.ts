import { tree, TreeMockItem, treeStyles } from '@ethlete/components/design/tree';
import { definePart, drawing, interactionRows } from '@design-system';
import selectedTint from './selected-tint.css?inline';

type RowInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  items: TreeMockItem[];
  expanded?: string[];
  value?: string;
  active?: string;
  forced?: { row: string; interaction: RowInteraction };
};

const FILES: TreeMockItem[] = [
  {
    label: 'src',
    children: [
      {
        label: 'app',
        children: [{ label: 'app.component.ts' }, { label: 'app.config.ts' }, { label: 'legacy.ts', disabled: true }],
      },
      { label: 'assets', children: [{ label: 'logo.svg' }] },
      { label: 'main.ts' },
    ],
  },
  { label: 'docs', children: [{ label: 'getting-started.md' }] },
  { label: 'package.json' },
];

const SELECT = 'data-et-action="emit:valueChange"';

const SHORT: TreeMockItem[] = [{ label: 'docs' }, { label: 'notes.md' }, { label: 'README.md' }];

const { states, grid } = interactionRows(
  {
    row: { items: SHORT },
    selected: { items: SHORT, value: 'notes.md' },
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props: Props, interaction: RowInteraction): Props => ({
      ...props,
      active: 'notes.md',
      forced: { row: 'notes.md', interaction },
    }),
  },
);

export default definePart({
  note: 'The SDK tree, drawn by its mock from @ethlete/components/design. Rows keep a roving tab stop, so a focused row draws the real :focus-visible ring.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...states,
    collapsed: { items: FILES },
    expanded: { items: FILES, expanded: ['src', 'src/app', 'docs'], value: 'src/app/app.config.ts' },
  },
  describe: {
    row: 'Three flat rows, none selected; check row padding and that notes.md looks like the others.',
    'row-hover': 'The notes.md row hovered; check that only that row tints.',
    'row-active': 'The notes.md row pressed; check that the press tint is deeper than hover.',
    'row-focus-visible': 'The notes.md row focused by keyboard; check that the focus ring wraps the row.',
    selected: 'The notes.md row selected; check the selected tint on that row.',
    'selected-hover': 'The selected notes.md row hovered; check that hover and selection both read.',
    'selected-active': 'The selected notes.md row pressed; check that the selected tint stays readable.',
    'selected-focus-visible': 'The selected notes.md row focused by keyboard; check that ring and tint both show.',
    collapsed: 'The file tree collapsed; check that folders show closed chevrons and files have none.',
    expanded: 'src, app and docs open with app.config.ts selected; check the indent per level and the dim legacy.ts.',
  },
  grid,
  widths: [320],
  controls: {
    row: { kind: 'row', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: ({ forced, ...props }: Props) =>
    drawing({
      body: tree({
        ...props,
        label: 'Files',
        rowAttributes: forced && { [forced.row]: `data-et-force="${forced.interaction}"` },
      }).replace(/<div [^>]*role="treeitem"[^>]*>/g, (row) =>
        row.replace(
          'role="treeitem"',
          `data-et-control="row"${row.includes('aria-disabled') ? '' : ` ${SELECT}`} role="treeitem"`,
        ),
      ),
      styles: [treeStyles, selectedTint].join('\n'),
    }),
});
