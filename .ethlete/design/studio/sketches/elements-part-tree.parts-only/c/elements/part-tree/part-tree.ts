import { definePart, drawing, html } from '@design-system';
import treeRow, { type Row } from '@system/components/tree-row';
import { type OpenSketch, type Props, segments, treeGrid, treeStates } from '@shared/tree';

const sketchRows = (items: OpenSketch[]): Row[] =>
  items.map((item) => ({
    label: item.name ? `${item.part}@${item.name}` : item.part,
    depth: 1,
    kind: 'leaf',
    action: 'emit:activate',
    status: item.status,
  }));

const divider = html`<div class="mx-space-2 my-space-1 h-px flex-none bg-et-surface-border" role="none"></div>`;

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/part-tree/part-tree.component.ts',
  note: 'A dense, quiet tree of the product parts only, no states: the Sketches group with the open sketches on top, a hairline, the layers with their parts (a part that belongs to a host one level under it), a hairline, and the collapsed Legacy group with its projects and calls at the bottom. Every group and host remembers open or closed; a warning mark on a part that needs a look and no counts anywhere.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [232],
  grid: treeGrid,
  states: treeStates,
  controls: { row: { kind: 'row', part: 'components/tree-row' } },
  render: async (props: Props) => {
    const parts = segments(props, sketchRows);
    const [sketches, layers, legacy] = await Promise.all([
      treeRow.render({ rows: parts.sketches }),
      treeRow.render({ rows: parts.layers }),
      treeRow.render({ rows: parts.legacy }),
    ]);
    const sections = [
      ...(parts.sketches.length > 0 ? [sketches.body] : []),
      layers.body,
      ...(parts.legacy.length > 0 ? [legacy.body] : []),
    ];

    return drawing({ body: html`<div class="flex flex-col">${sections.join(divider)}</div>`, styles: layers.styles });
  },
});
