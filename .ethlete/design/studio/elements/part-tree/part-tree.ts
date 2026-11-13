import { definePart } from '@design-system';
import treeRow, { type Row } from '@system/components/tree-row';
import { type OpenSketch, type Props, partRows, segments, treeGrid, treeStates } from './shared/tree';

const sketchRows = (items: OpenSketch[]): Row[] =>
  items.flatMap((item): Row[] => {
    const host = (item.nested?.length ?? 0) > 0;

    return [
      {
        label: item.name ? `${item.part}@${item.name}` : item.part,
        depth: 1,
        kind: host ? 'part' : 'leaf',
        action: host ? 'emit:expandedChange' : 'emit:activate',
        ...(host ? { expanded: true } : {}),
        ...(item.selected ? { selected: true } : {}),
        status: item.status,
      },
      ...(item.nested ?? []).flatMap((child) => partRows(child, 2)),
    ];
  });

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/part-tree/part-tree.component.ts',
  note: 'A dense, quiet tree of the product parts only, no states: the Sketches group with the open sketches on top, then the layers with their parts, a part that belongs to a host one level under it, and the collapsed Legacy group with its projects and calls at the bottom. Every group and host remembers open or closed; a warning mark on a part that needs a look and no counts anywhere.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [232],
  grid: treeGrid,
  states: treeStates,
  controls: { row: { kind: 'row', part: 'components/tree-row' } },
  render: (props: Props) => {
    const { sketches, layers, legacy } = segments(props, sketchRows);

    return treeRow.render({ rows: [...sketches, ...layers, ...legacy] });
  },
});
