import { html, slot } from '@design-system';
import { sampleStepper } from '../../../../../../apps/ethlete-studio/src/app/design-harness/sample-product';

type Interaction = 'rest' | 'hover' | 'active' | 'focus-visible';

type Target = 'count' | 'add';

type Cell = { target: Target; interaction: Interaction };

type Box = { x: number; y: number; width: number; height: number };

const REST: Interaction = 'rest';

const interactions: Interaction[] = ['rest', 'hover', 'active', 'focus-visible'];

const targets: Target[] = ['count', 'add'];

const CELL = { width: 196, height: 96 };

const REGIONS: Record<Target, Box> = {
  count: { x: 38, y: 8, width: 28, height: 30 },
  add: { x: 96, y: 8, width: 88, height: 30 },
};

const regionOf = (cell: Cell) => (cell.interaction === REST ? undefined : REGIONS[cell.target]);

const insetOf = (edge: number) => `${edge}px`;

const markOf = (box: Box) =>
  html`<div class="pointer-events-none absolute inset-0 overflow-clip" data-diff-mark data-et-skip="CLIPPED">
    <div
      class="absolute shadow-[0_0_0_100vmax_color-mix(in_srgb,var(--et-surface-background-solid)_50%,transparent)]"
      style="left: ${insetOf(box.x)}; top: ${insetOf(box.y)}; right: ${insetOf(
        CELL.width - box.x - box.width,
      )}; bottom: ${insetOf(CELL.height - box.y - box.height)}"
    ></div>
  </div>`;

const drawCell = (cell: Cell) => {
  const body = sampleStepper(cell.interaction === REST ? cell.target : `${cell.target}-${cell.interaction}`);
  const region = regionOf(cell);

  return html`<div
    class="relative ${region ? '' : 'opacity-50'}"
    style="width: ${CELL.width}px; height: ${CELL.height}px"
  >
    <div class="size-full overflow-clip p-space-2" ${slot('frame')}>${body}</div>
    ${region ? markOf(region) : ''}
  </div>`;
};

/** The quantity stepper of the sample product as a state grid of framed part stills, each state in an interaction dimmed outside the region it changes against the rest state of its row, a rest state dimmed whole. */
export const diffGrid = () => ({
  columns: interactions,
  rows: targets.map((target) => ({
    label: target,
    cells: interactions.map((interaction) => drawCell({ target, interaction })),
  })),
});
