import { definePart } from '@design-system';
import treeRow, { type Row } from '@system/components/tree-row';
import { type OpenSketch, type Props, segments, treeGrid, treeStates } from '@shared/tree';

const sketchRows = (items: OpenSketch[]): Row[] =>
  [...new Set(items.map((item) => item.part))].flatMap((part): Row[] => {
    const named = items.filter((item) => item.part === part && item.name !== undefined);
    const created = items.find((item) => item.part === part && item.name === undefined);

    if (created) {
      return [{ label: part, depth: 1, kind: 'leaf', action: 'emit:activate', status: created.status }];
    }

    return [
      { label: part, depth: 1, kind: 'part', expanded: true, action: 'emit:expandedChange' },
      ...named.map((item): Row => ({
        label: item.name ?? part,
        depth: 2,
        kind: 'leaf',
        action: 'emit:activate',
        status: item.status,
      })),
    ];
  });

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/part-tree/part-tree.component.ts',
  note: 'A dense, quiet tree of the product parts only, no states: the Sketches group on top lists each part an open sketch changes, its sketches one level under it (a new part is one row), then the layers with their parts, a part that belongs to a host one level under it, and the collapsed Legacy group with its projects and calls at the bottom. Every group and host remembers open or closed; a warning mark on a part that needs a look and no counts anywhere.',
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
