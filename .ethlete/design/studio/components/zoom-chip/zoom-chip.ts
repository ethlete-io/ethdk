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

const tooltipPane = (id: ZoomControl, text: string) => {
  const anchor = `[data-et-control="${id}"]`;

  return id === 'fit'
    ? `<span class="absolute right-[calc(50%-30px)] bottom-full z-10 mb-2">${tooltip({ text, placement: 'top-end', anchor })}</span>`
    : `<span class="absolute bottom-full left-0 z-10 mb-2 w-max">${tooltip({ text, placement: 'top', anchor })}</span>`;
};

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
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  states,
  grid,
  describe: {
    out: 'The zoom chip at 25 % with −, the percent, + and Fit; check that the four buttons sit flush in one bordered chip with its shadow.',
    'out-hover': 'The − button hovered; check the SDK hover fill on − only, inside the chip radius.',
    'out-active': 'The − button pressed; check the darker press fill on − only.',
    'out-focus-visible':
      'The − button focused by keyboard; check its focus ring, not clipped by the chip border, and that no tooltip shows.',
    reset: 'The zoom chip at 100 %; check that the percent label keeps its width and stays centred between − and +.',
    'reset-hover': 'The 100 % button hovered; check the hover fill fits the wider label.',
    'reset-active': 'The 100 % button pressed; check the press fill on the percent only.',
    'reset-focus-visible':
      'The 100 % button focused by keyboard; check its focus ring and the Zoom to 100 % (Shift+0) tooltip centred above it.',
    in: 'The zoom chip at 250 %; check that the wider percent does not push + or Fit out of the chip.',
    'in-hover': 'The + button hovered; check the hover fill on + only.',
    'in-active': 'The + button pressed; check the press fill on + only.',
    'in-focus-visible': 'The + button focused by keyboard; check its focus ring and that no tooltip shows.',
    fit: 'The zoom chip at 100 % with Fit at the end; check that Fit sits flush against the right chip edge.',
    'fit-hover': 'The Fit button hovered; check the hover fill follows the right chip corner.',
    'fit-active': 'The Fit button pressed; check the press fill on Fit only.',
    'fit-focus-visible':
      'The Fit button focused by keyboard; check its focus ring and the Zoom to fit (Shift+1) tooltip aligned to its end, not clipped.',
  },
  controls: { out: BUTTON, reset: BUTTON, in: BUTTON, fit: BUTTON },
  render: (props: Props) =>
    drawing({
      body: html`<div class="${tooltipOpen(props) ? (props.target === 'fit' ? 'pt-13 pr-1' : 'pt-13 pl-5.75') : ''}">
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
