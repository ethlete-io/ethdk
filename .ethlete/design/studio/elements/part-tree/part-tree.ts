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
  describe: {
    'components-open':
      'The open sketches on top and Components open with title-search nested under title-bar; check the indents, tree-row selected and the select warning.',
    remembered:
      'Sketches closed, Components and Elements open, title-bar folded; check that the remembered groups stay open and title-search is hidden.',
    'legacy-open':
      'Every layer closed and Legacy open with the studio project and its calls; check the deeper indent of the calls, with timetrack still closed.',
    'cross-layer':
      'Pages open with hold-trigger nested under the sketches page; check the small muted Components tag after hold-trigger and its indent one level under sketches.',
    row: 'The nested title-search row at rest in the open tree; check that it sits one level under title-bar without a fill.',
    'row-hover': 'The nested title-search row hovered; check the faint raised fill on that row only.',
    'row-active': 'The nested title-search row pressed; check the stronger press fill on that row only.',
    'row-focus-visible':
      'The nested title-search row focused by keyboard; check the focus ring around that row, not clipped by the tree edge.',
  },
  controls: { row: { kind: 'row', part: 'components/tree-row' } },
  render: (props: Props) => {
    const { sketches, layers, legacy } = segments(props, sketchRows);

    return treeRow.render({ rows: [...sketches, ...layers, ...legacy] });
  },
});
