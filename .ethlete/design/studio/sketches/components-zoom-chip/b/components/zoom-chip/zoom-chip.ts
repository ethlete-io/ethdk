import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { zoomReset } from '@system/components/zoom-reset';

type ZoomControl = 'out' | 'reset' | 'in' | 'fit';

type ChipButton = Exclude<ZoomControl, 'reset'>;

type ZoomInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { percent: number; class?: string; target?: ZoomControl; interaction?: ZoomInteraction };

const ARIA_LABEL: Record<ZoomControl, string> = {
  out: 'Verkleinern',
  reset: 'Auf 100 % zoomen',
  in: 'Vergrößern',
  fit: 'Einpassen',
};

const OUTPUT: Record<ZoomControl, string> = { out: 'zoomOut', reset: 'zoomReset', in: 'zoomIn', fit: 'fit' };

const chipButton = (id: ChipButton, label: string, { target, interaction }: Props) => {
  const markup = button({ label, variant: 'transparent', color: 'surface', size: 'sm' }).replace(
    /^<button /,
    `<button data-et-control="${id}" data-et-action="emit:${OUTPUT[id]}" aria-label="${ARIA_LABEL[id]}" data-can-animate `,
  );

  return html`<span class="contents" data-camera-${id}
    >${interaction && target === id ? forceInteraction(markup, interaction) : markup}</span
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
  note: 'The zoom chip in the canvas corner: zoom out, the zoom in percent (components/zoom-reset, resets to 100 %), zoom in, fit. Each row draws one button at rest, hovered, pressed and focused, at 25 %, 100 % or 250 %. The root has `data-canvas-zoom`; each button sits in a `data-camera-out`, `-reset`, `-in` or `-fit` wrapper for a setup to wire. A host places it through `class`, for example `absolute right-space-3 bottom-space-3`.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states,
  grid,
  controls: { out: BUTTON, reset: { kind: 'button', part: 'components/zoom-reset' }, in: BUTTON, fit: BUTTON },
  render: (props: Props) =>
    drawing({
      body: html`<div
        class="inline-flex rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border-solid)) shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16)) bg-et-surface-bg ${
          props.class ?? ''
        }"
        data-et-auto-surface
        data-canvas-zoom
      >
        ${chipButton('out', '−', props)}<span class="contents" data-camera-reset
          >${zoomReset({
            percent: props.percent,
            ...(props.target === 'reset' && props.interaction ? { interaction: props.interaction } : {}),
          })}</span
        >${chipButton('in', '+', props)}${chipButton('fit', 'Fit', props)}
      </div>`,
      styles: buttonStyles,
    }),
});
