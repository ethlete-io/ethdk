import { drawing, html } from '@design-system';
import treeRow from '@system/components/tree-row';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import styles from './many-states.css?inline';

export type GridRow = { label: string; cells: (string | undefined)[] };
export type StateGridDrawing = { columns: string[]; rows: GridRow[] };

type StateName = keyof typeof treeRow.states;

const drawState = async (state: StateName) => (await treeRow.render(treeRow.states[state])).body;

export const treeRowGrid = async (): Promise<StateGridDrawing> => {
  const grid = treeRow.grid ?? { columns: [], rows: {} };
  const columns = [...grid.columns];
  const rows = await Promise.all(
    Object.entries(grid.rows).map(async ([label, byColumn]) => ({
      label,
      cells: await Promise.all(
        columns.map((column) => {
          const state = (byColumn as Record<string, StateName | undefined>)[column];
          return state ? drawState(state) : Promise.resolve(undefined);
        }),
      ),
    })),
  );
  return { columns, rows };
};

const treeSelected = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    {
      title: 'Components',
      open: true,
      parts: [
        { name: 'button', leaf: true },
        { name: 'form-field' },
        { name: 'select', warns: true },
        { name: 'tree-row', selected: true, states: [{ name: 'grid' }, { name: 'tree' }] },
      ],
    },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
};

const frame = (label: string, width: string, body: string) =>
  html`<figure class="st-many-frame">
    <figcaption class="st-many-head">
      ${label}${width ? `<span class="st-many-head-width">${width}</span>` : ''}
    </figcaption>
    ${body}
  </figure>`;

export const manyStatesView = async (grid: string, gridStyles: string) => {
  const tree = await partTree.render(treeSelected);
  const rowDrawing = await treeRow.render(treeRow.states.tree);
  const canvas = html`<div class="st-many">
    <div class="st-many-frames">
      ${frame('grid', '', grid)} ${frame('tree', '280', `<div class="st-many-tree">${rowDrawing.body}</div>`)}
    </div>
    <div class="st-many-zoom"><span>Fit</span><span class="st-many-zoom-value">75%</span></div>
  </div>`;
  const shell = await shellMain.render({ section: 'System', product: 'studio', side: tree.body, content: canvas });
  return drawing({ body: shell.body, styles: shell.styles + tree.styles + rowDrawing.styles + styles + gridStyles });
};
