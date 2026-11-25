import { drawing, html, slot } from '@design-system';
import partTree from '@system/elements/part-tree';
import { canvasFrame, canvasFrameStyles, canvasView, stateGrid } from '@system/elements/canvas-frames';
import type { StateGridDrawing } from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';
import {
  SAMPLE_STEPPER_WIDTH,
  sampleStepper,
} from '../../../../../../apps/ethlete-studio/src/app/design-harness/sample-product';

const STEPPER_COLUMNS = ['rest', 'hover', 'active', 'focus-visible'];

const STEPPER_ROWS = ['minus', 'count', 'plus', 'add'];

export const stepperGrid = (): StateGridDrawing => ({
  columns: STEPPER_COLUMNS,
  rows: STEPPER_ROWS.map((target) => ({
    label: target,
    cells: STEPPER_COLUMNS.map((column) => sampleStepper(column === 'rest' ? target : `${target}-${column}`)),
  })),
});

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
        { name: 'quantity-stepper', selected: true, states: [{ name: 'grid' }, { name: 'stepper' }] },
      ],
    },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Pages', open: false, parts: [] },
  ],
};

export const manyStatesView = async (grid: StateGridDrawing) => {
  const tree = await partTree.render(treeSelected);
  const canvas = await canvasView(
    [
      canvasFrame('grid', html`<div ${slot('shot')}>${stateGrid(grid)}</div>`),
      canvasFrame(
        'stepper',
        html`<div style="width: ${SAMPLE_STEPPER_WIDTH}px" ${slot('shot')}>${sampleStepper('count')}</div>`,
        `${SAMPLE_STEPPER_WIDTH}`,
      ),
    ],
    '75%',
    {},
    '',
    true,
  );
  const menu = await studioMenu({ open: false });
  const shell = await shellMain.render({
    studio: menu.body,
    section: 'System',
    product: 'studio',
    side: tree.body,
    content: canvas,
  });
  return drawing({
    body: shell.body,
    setup: menu.setup,
    styles: shell.styles + menu.styles + tree.styles + canvasFrameStyles,
  });
};
