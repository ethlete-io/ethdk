import { definePart } from '@design-system';
import treeRow, { type Row } from '@system/components/tree-row';

type TreeState = { name: string; inert?: boolean; selected?: boolean };
type TreePart = { name: string; warns?: boolean; leaf?: boolean; selected?: boolean; states?: TreeState[] };
type TreeLayer = { title: string; open: boolean; parts: TreePart[] };

type Props = { layers: TreeLayer[] };

const partRows = (part: TreePart): Row[] => [
  {
    label: part.name,
    depth: 1,
    kind: part.leaf === true ? 'leaf' : 'part',
    expanded: part.states !== undefined,
    selected: part.selected === true,
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

const componentsOpen: Props = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    { title: 'Elements', open: false, parts: [] },
    {
      title: 'Components',
      open: true,
      parts: [{ name: 'button', leaf: true, selected: true }, { name: 'form-field' }, { name: 'select', warns: true }],
    },
    { title: 'Pages', open: false, parts: [] },
  ],
};

export default definePart({
  note: 'A dense, quiet tree of the product parts: layers, then parts, then the frames of an open part (a part drawn in one frame is a leaf), with a warning mark on a part that needs a look and no counts anywhere.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [232],
  states: { 'components-open': componentsOpen },
  render: ({ layers }: Props) => treeRow.render({ rows: layers.flatMap(layerRows) }),
});
