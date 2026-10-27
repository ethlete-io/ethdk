import { definePart, drawing, html } from '@design-system';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './canvas-frames.css?inline';

type Props = { part: string; states: string[]; selected: string; zoom: string };

const frame = (part: string, state: string, selected: boolean) =>
  `<figure class="st-canvas-frame"${selected ? ' data-selected' : ''}><figcaption class="st-canvas-caption">${part} / ${state}</figcaption><div class="st-canvas-stage"></div></figure>`;

export const buttonStates: Props = {
  part: 'button',
  states: ['primary', 'secondary', 'disabled'],
  selected: 'primary',
  zoom: '100%',
};

export default definePart<Props>({
  note: 'The frames of one part on the canvas, one per state with a part / state caption, and the zoom chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    'button-states': buttonStates,
  },
  render: ({ part, states, selected, zoom }) =>
    drawing({
      body: html`<div class="st-canvas">
        <div class="st-canvas-frames">${states.map((state) => frame(part, state, state === selected)).join('')}</div>
        <div class="st-canvas-zoom"><span>Fit</span><span class="st-canvas-zoom-value">${zoom}</span></div>
      </div>`,
      styles: tokens + styles,
    }),
});
