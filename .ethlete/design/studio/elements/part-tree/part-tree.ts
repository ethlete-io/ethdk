import { definePart, interactionRows, type Interaction } from '@design-system';
import treeRow, { type Row } from '@system/components/tree-row';

type RowInteraction = Extract<Interaction, 'hover' | 'active' | 'focus-visible'>;
type TreeState = { name: string; inert?: boolean; selected?: boolean };
type TreePart = {
  name: string;
  interaction?: RowInteraction;
  warns?: boolean;
  leaf?: boolean;
  selected?: boolean;
  states?: TreeState[];
};
type TreeLayer = { title: string; open: boolean; parts: TreePart[] };

type Props = { layers: TreeLayer[]; interaction?: RowInteraction };

const partRows = (part: TreePart): Row[] => [
  {
    label: part.name,
    depth: 1,
    kind: part.leaf === true ? 'leaf' : 'part',
    expanded: part.states !== undefined,
    selected: part.selected === true,
    ...(part.interaction ? { interaction: part.interaction } : {}),
    ...(part.warns ? { warning: 'Render check: 1 warning' } : {}),
  },
  ...(part.states ?? []).map((state): Row => ({
    label: state.name,
    depth: 2,
    kind: 'leaf',
    inert: state.inert === true,
    selected: state.selected === true,
  })),
];

const layerRows = (layer: TreeLayer): Row[] => [
  { label: layer.title, depth: 0, kind: 'group', expanded: layer.open },
  ...layer.parts.flatMap(partRows),
];

const componentsParts: TreePart[] = [
  { name: 'button', leaf: true, selected: true },
  { name: 'form-field' },
  { name: 'select', warns: true },
];

const withInteraction = (interaction?: RowInteraction): Props => ({
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    { title: 'Elements', open: false, parts: [] },
    {
      title: 'Components',
      open: true,
      parts: componentsParts.map((part) =>
        interaction && part.name === 'form-field' ? { ...part, interaction } : part,
      ),
    },
    { title: 'Pages', open: false, parts: [] },
  ],
});

const rows = interactionRows<Props, 'row', RowInteraction>(
  { row: withInteraction() },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => withInteraction(interaction) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/part-tree/part-tree.component.ts',
  note: 'A dense, quiet tree of the product parts: layers, then parts, then the frames of an open part (a part drawn in one frame is a leaf), with a warning mark on a part that needs a look and no counts anywhere.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [232],
  ...rows,
  states: { 'components-open': withInteraction(), ...rows.states },
  controls: { row: { kind: 'row', part: 'components/tree-row' } },
  render: ({ layers }: Props) => treeRow.render({ rows: layers.flatMap(layerRows) }),
});
