import { drawing } from '@design-system';
import treeRow from '@system/components/tree-row';
import partTree from '@system/elements/part-tree';
import { canvasFrame, canvasFrameStyles, canvasView, stateGrid } from '@system/elements/canvas-frames';
import type { StateGridDrawing } from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';

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

export const manyStatesView = async (grid: StateGridDrawing) => {
  const tree = await partTree.render(treeSelected);
  const rowDrawing = await treeRow.render(treeRow.states.tree);
  const canvas = await canvasView(
    [
      canvasFrame('grid', stateGrid(grid)),
      canvasFrame('tree', `<div style="width: 280px">${rowDrawing.body}</div>`, '280'),
    ],
    '75%',
  );
  const shell = await shellMain.render({ section: 'System', product: 'studio', side: tree.body, content: canvas });
  return drawing({ body: shell.body, styles: shell.styles + tree.styles + rowDrawing.styles + canvasFrameStyles });
};
