import { html, slot } from '@design-system';
import holdTriggerPart, { holdTriggerStyles } from '@system/components/hold-trigger';

type Interaction = 'rest' | 'hover' | 'active' | 'focus-visible';

type Cell = { open: boolean; interaction: Interaction };

type Box = { x: number; y: number; width: number; height: number };

const BASE: Cell = { open: false, interaction: 'rest' };

const interactions: Interaction[] = ['rest', 'hover', 'active', 'focus-visible'];

const CELL = { width: 220, height: 96 };

const STROKE = 2;

const REGIONS = {
  trigger: { x: 8, y: 8, width: 120, height: 28 },
  reason: { x: 8, y: 48, width: 150, height: 20 },
  both: { x: 8, y: 8, width: 150, height: 60 },
} satisfies Record<string, Box>;

const content = html`<span class="text-ui-sm text-et-surface-muted">Pausiert</span>`;
const reason = html`<span class="font-ui-medium text-et-surface">Wartet auf ADR 0331</span>`;

const regionOf = (cell: Cell) => {
  const trigger = cell.interaction !== BASE.interaction;
  const reasonChanged = cell.open !== BASE.open;
  if (trigger && reasonChanged) return REGIONS.both;
  if (trigger) return REGIONS.trigger;
  if (reasonChanged) return REGIONS.reason;
  return undefined;
};

const insetOf = (edge: number) => `${Math.max(STROKE, edge - STROKE)}px`;

const markOf = (box: Box) =>
  html`<div class="pointer-events-none absolute inset-0 overflow-clip" data-diff-mark data-et-skip="CLIPPED">
    <div
      class="absolute rounded-control-sm outline-2 outline-solid outline-(--et-theme-color-primary-solid) shadow-[0_0_0_100vmax_color-mix(in_srgb,color-mix(in_srgb,var(--et-surface-background-solid)_82%,var(--et-surface-color-solid))_78%,transparent)]"
      style="left: ${insetOf(box.x)}; top: ${insetOf(box.y)}; right: ${insetOf(
        CELL.width - box.x - box.width,
      )}; bottom: ${insetOf(CELL.height - box.y - box.height)}"
    ></div>
  </div>`;

const drawCell = async (cell: Cell) => {
  const { body } = await holdTriggerPart.render({
    content,
    reason,
    open: cell.open,
    interaction: cell.interaction === 'rest' ? undefined : cell.interaction,
  });
  const region = regionOf(cell);

  return html`<div class="relative" style="width: ${CELL.width}px; height: ${CELL.height}px">
    <div class="size-full overflow-clip p-space-2" ${slot('frame')}>${body}</div>
    ${region ? markOf(region) : ''}
  </div>`;
};

/** The states of components/hold-trigger as a state grid of framed part stills, each state but closed rest marked over the region it changes against closed rest. */
export const diffGrid = async () => ({
  columns: interactions,
  rows: await Promise.all(
    [false, true].map(async (open) => ({
      label: open ? 'open' : 'closed',
      cells: await Promise.all(interactions.map((interaction) => drawCell({ open, interaction }))),
    })),
  ),
});

/** The CSS the cells of `diffGrid` need on top of the canvas frame styles. */
export const diffGridStyles = holdTriggerStyles;
