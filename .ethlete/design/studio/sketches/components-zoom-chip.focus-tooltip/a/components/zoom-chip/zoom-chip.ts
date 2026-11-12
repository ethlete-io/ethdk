import { definePart, drawing, forceInteraction, html, interactionRows, withAction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { tooltip, tooltipStyles } from '@ethlete/components/design/tooltip';

type ZoomControl = 'out' | 'reset' | 'in' | 'fit';

type ZoomInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { percent: number; class?: string; target?: ZoomControl; interaction?: ZoomInteraction };

const ARIA_LABEL: Record<ZoomControl, string> = {
  out: 'Verkleinern',
  reset: 'Auf 100 % zoomen',
  in: 'Vergrößern',
  fit: 'Einpassen',
};

const TITLE: Partial<Record<ZoomControl, string>> = {
  reset: 'Zoom to 100 % (Shift+0)',
  fit: 'Zoom to fit (Shift+1)',
};

const tooltipOpen = ({ target, interaction }: Props) =>
  interaction === 'focus-visible' && target !== undefined && TITLE[target] !== undefined;

const tooltipPane = (id: ZoomControl, text: string) =>
  id === 'fit'
    ? `<span class="absolute right-[calc(50%-30px)] bottom-full z-10 mb-2">${tooltip({ text, placement: 'top-end' })}</span>`
    : `<span class="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2">${tooltip({ text, placement: 'top' })}</span>`;

const OUTPUT: Record<ZoomControl, string> = { out: 'zoomOut', reset: 'zoomReset', in: 'zoomIn', fit: 'fit' };

const chipButton = (id: ZoomControl, label: string, { target, interaction }: Props) => {
  const markup = withAction(
    button({ label, variant: 'transparent', color: 'surface', size: 'sm' }).replace(
      /^<button /,
      `<button data-et-control="${id}" aria-label="${ARIA_LABEL[id]}" data-can-animate `,
    ),
    `emit:${OUTPUT[id]}`,
  );

  const forced = interaction && target === id ? forceInteraction(markup, interaction) : markup;
  const text = TITLE[id];

  return html`<span class="contents" data-camera-${id}
    >${text && interaction === 'focus-visible' && target === id ? `<span class="relative inline-flex">${forced}${tooltipPane(id, text)}</span>` : forced}</span
  >`;
};

const rows = interactionRows<Props, ZoomControl, ZoomInteraction>(
  {
    out: { percent: 25 },
    reset: { percent: 100 },
    in: { percent: 250 },
    fit: { percent: 100 },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export const grid = rows.grid;

export const states = Object.fromEntries(
  Object.entries(rows.states).map(([name, props]) => {
    const target = (Object.keys(OUTPUT) as ZoomControl[]).find((id) => name.startsWith(`${id}-`));
    return [name, target ? { ...(props as Props), target } : props];
  }),
) as typeof rows.states;

const BUTTON = { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] };

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/zoom-chip/zoom-chip.component.ts',
  note: 'The zoom chip in the canvas corner: zoom out, the zoom in percent (resets to 100 %), zoom in, fit. Each row draws one button at rest, hovered, pressed and focused, at 25 %, 100 % or 250 %. The root has `data-canvas-zoom`; each button sits in a `data-camera-out`, `-reset`, `-in` or `-fit` wrapper for a setup to wire. A host places it through `class`, for example `absolute right-space-3 bottom-space-3`.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states,
  grid,
  controls: { out: BUTTON, reset: BUTTON, in: BUTTON, fit: BUTTON },
  render: (props: Props) =>
    drawing({
      body: html`<div class="${tooltipOpen(props) ? 'pt-12 pr-1 pl-8' : ''}">
        <div
          class="inline-flex rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border-solid)) shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16)) bg-et-surface-bg ${
            props.class ?? ''
          }"
          data-et-auto-surface
          data-canvas-zoom
        >
          ${chipButton('out', '−', props)}${chipButton('reset', `${props.percent} %`, props)}${chipButton(
            'in',
            '+',
            props,
          )}${chipButton('fit', 'Fit', props)}
        </div>
      </div>`,
      styles: [buttonStyles, tooltipStyles].join('\n'),
    }),
});
