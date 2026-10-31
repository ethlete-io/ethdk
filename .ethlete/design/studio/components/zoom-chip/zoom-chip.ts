import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';

type ZoomControl = 'out' | 'reset' | 'in' | 'fit';

type ZoomInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { percent: number; class?: string; target?: ZoomControl; interaction?: ZoomInteraction };

const chipButton = (id: ZoomControl, label: string, { target, interaction }: Props, extra?: string) => {
  const markup = button({ label, variant: 'transparent', color: 'surface', size: 'sm', class: extra }).replace(
    /^<button /,
    `<button data-et-control="${id}" data-can-animate `,
  );

  return html`<span class="contents" data-camera-${id}
    >${interaction && target === id ? forceInteraction(markup, interaction) : markup}</span
  >`;
};

export const { states, grid } = interactionRows<Props, 'out' | 'reset' | 'in' | 'fit', ZoomInteraction>(
  {
    out: { percent: 25, target: 'out' },
    reset: { percent: 100, target: 'reset' },
    in: { percent: 250, target: 'in' },
    fit: { percent: 100, target: 'fit' },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const BUTTON = { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] };

export default definePart({
  note: 'The zoom chip in the canvas corner: zoom out, the zoom in percent (resets to 100 %), zoom in, fit. Each row draws one button at rest, hovered, pressed and focused, at 25 %, 100 % or 250 %. The root has `data-canvas-zoom`; each button sits in a `data-camera-out`, `-reset`, `-in` or `-fit` wrapper for a setup to wire. A host places it through `class`, for example `absolute right-space-3 bottom-space-3`.',
  madeBy: ['claude-opus-5-5'],
  states,
  grid,
  controls: { out: BUTTON, reset: BUTTON, in: BUTTON, fit: BUTTON },
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="inline-flex rounded-control-md border border-et-surface-interaction et-surface--dark bg-(--et-surface-background-solid)${
          props.class ? ` ${props.class}` : ''
        }"
        data-canvas-zoom
      >
        ${chipButton('out', '−', props)}${chipButton('reset', `${props.percent} %`, props, 'tabular-nums')}${chipButton(
          'in',
          '+',
          props,
        )}${chipButton('fit', 'Fit', props)}
      </div>`,
      styles: buttonStyles,
    }),
});
