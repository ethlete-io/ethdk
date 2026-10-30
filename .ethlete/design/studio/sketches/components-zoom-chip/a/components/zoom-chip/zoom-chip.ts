import { definePart, drawing, html } from '@design-system';
import { buttonStyles } from '@ethlete/components/design/button';
import button from '@system/components/button';

type Props = { percent: number; class?: string };

const chipButton = (label: string, extra = '') =>
  button.render({ label, variant: 'transparent', color: 'surface', size: 'sm', class: extra || undefined });

const [zoomOut, zoomValue, zoomIn, zoomFit] = await Promise.all([
  chipButton('−'),
  chipButton('ZOOM', 'tabular-nums'),
  chipButton('+'),
  chipButton('Fit'),
]);

export default definePart({
  note: 'The zoom chip in the canvas corner: zoom out, the zoom in percent (resets to 100 %), zoom in, fit. The root has `data-canvas-zoom`; each button sits in a `data-camera-out`, `-reset`, `-in` or `-fit` wrapper for a setup to wire. A host places it through `class`, for example `absolute right-space-3 bottom-space-3`.',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: { percent: 100 },
    'zoomed-in': { percent: 250 },
    'zoomed-out': { percent: 25 },
  },
  render: ({ percent, class: extra }: Props) =>
    drawing({
      body: html`<div
        class="inline-flex rounded-control-md border border-surface-border bg-surface${extra ? ` ${extra}` : ''}"
        data-canvas-zoom
      >
        <span class="contents" data-camera-out>${zoomOut.body}</span>
        <span class="contents" data-camera-reset>${zoomValue.body.replace('ZOOM', `${percent} %`)}</span>
        <span class="contents" data-camera-in>${zoomIn.body}</span>
        <span class="contents" data-camera-fit>${zoomFit.body}</span>
      </div>`,
      styles: buttonStyles,
    }),
});
