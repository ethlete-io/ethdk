import { drawing, html, slot } from '@design-system';
import partTree from '@system/elements/part-tree';
import { canvasFrame, canvasFrameStyles, canvasView, stateGrid } from '@system/elements/canvas-frames';
import type { StateGridDrawing } from '@system/elements/canvas-frames';
import { FARN_PRODUCT, FARN_TREE } from './farn-product';
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

export const manyStatesView = async (grid: StateGridDrawing) => {
  const tree = await partTree.render(FARN_TREE);
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
    product: FARN_PRODUCT,
    side: tree.body,
    content: canvas,
  });
  return drawing({
    body: shell.body,
    setup: menu.setup,
    styles: shell.styles + menu.styles + tree.styles + canvasFrameStyles,
  });
};
