import { html } from '@design-system';
import { holdTrigger, holdTriggerStyles } from '@system/components/hold-trigger';

type Interaction = 'rest' | 'hover' | 'active' | 'focus-visible';

type Cell = { open: boolean; interaction: Interaction };

const BASE: Cell = { open: false, interaction: 'rest' };

const interactions: Interaction[] = ['rest', 'hover', 'active', 'focus-visible'];

const content = html`<span class="text-ui-sm text-et-surface-muted">Pausiert</span>`;
const reason = html`<span class="font-ui-medium text-et-surface">Wartet auf ADR 0331</span>`;

const REGION = 'data-diff-region';

const regionOf = (cell: Cell) => {
  const trigger = cell.interaction !== BASE.interaction;
  const reasonChanged = cell.open !== BASE.open;
  if (trigger && reasonChanged) return 'both';
  if (trigger) return 'trigger';
  if (reasonChanged) return 'reason';
  return undefined;
};

const marked = (markup: string, region: ReturnType<typeof regionOf>) => {
  switch (region) {
    case 'trigger':
      return markup.replace(/data-sk-hold(?=\s)/, `data-sk-hold ${REGION}`);
    case 'reason':
      return markup.replace('data-sk-hold-reason', `data-sk-hold-reason ${REGION}`);
    case 'both':
      return markup.replace('<span', `<span ${REGION}`);
    default:
      return markup;
  }
};

const drawCell = (cell: Cell, look: string) => {
  const trigger = holdTrigger({
    content,
    reason,
    open: cell.open,
    interaction: cell.interaction === 'rest' ? undefined : cell.interaction,
  });
  return html`<div class="relative isolate overflow-clip p-space-2 ${look}">${marked(trigger, regionOf(cell))}</div>`;
};

/** The states of components/hold-trigger as a state grid, the region each state changes against closed rest marked by `data-diff-region`; `look` styles that region. */
export const diffGrid = (look: string) => ({
  columns: interactions,
  rows: [false, true].map((open) => ({
    label: open ? 'open' : 'closed',
    cells: interactions.map((interaction) => drawCell({ open, interaction }, look)),
  })),
});

/** The CSS the cells of `diffGrid` need on top of the canvas frame styles. */
export const diffGridStyles = holdTriggerStyles;
