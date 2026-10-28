import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './canvas-frames.css?inline';

type Props = { part: string; states: string[]; selected: string; zoom: string };

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Cancel', variant: 'outline' },
  tonal: { label: 'Filter', variant: 'tonal' },
} as const;

const frame = (part: string, state: string, selected: boolean, stage: string) =>
  `<figure class="st-canvas-frame"${selected ? ' data-selected' : ''}><figcaption class="st-canvas-caption">${part} / ${state}</figcaption><div class="st-canvas-stage">${stage}</div></figure>`;

export const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  selected: 'filled',
  zoom: '100%',
};

export default definePart<Props>({
  note: 'The frames of one part on the canvas, one per state with a part / state caption, and the zoom chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    default: defaultFrames,
  },
  render: async ({ part, states, selected, zoom }) => {
    const buttons = await Promise.all(
      states.map((state) => button.render(buttonStates[state as keyof typeof buttonStates])),
    );
    return drawing({
      body: html`<div class="st-canvas">
        <div class="st-canvas-frames">
          ${states.map((state, i) => frame(part, state, state === selected, buttons[i]!.body)).join('')}
        </div>
        <div class="st-canvas-zoom"><span>Fit</span><span class="st-canvas-zoom-value">${zoom}</span></div>
      </div>`,
      styles: tokens + buttons[0]?.styles + styles,
    });
  },
});
