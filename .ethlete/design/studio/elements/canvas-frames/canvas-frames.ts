import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import styles from './canvas-frames.css?inline';

type Props = { part: string; states: string[]; zoom: string };

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Save', variant: 'outline' },
  tonal: { label: 'Save', variant: 'tonal' },
} as const;

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

const forcedOf = (interaction: (typeof interactions)[number]) =>
  interaction === 'rest' || interaction === 'pressed' ? {} : { interaction };

const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  zoom: '100%',
};

export default definePart({
  note: 'The frames of one part on the canvas as a grid, one row per state and one column per interaction, and the zoom chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    default: defaultFrames,
  },
  render: async ({ part, states, zoom }: Props) => {
    const rows = await Promise.all(
      states.map(async (state) => {
        const base = buttonStates[state as keyof typeof buttonStates];
        const cells = await Promise.all(
          interactions.map((interaction) =>
            button.render(interaction === 'pressed' ? { ...base, pressed: true } : base, forcedOf(interaction)),
          ),
        );
        return { state, cells };
      }),
    );
    const first = rows[0]?.cells[0];
    return drawing({
      body: html`<div class="st-canvas">
        <figure class="st-canvas-frame">
          <figcaption class="st-canvas-title">${part}</figcaption>
          <div class="st-canvas-grid" style="--st-cols: ${interactions.length}">
            <span></span>
            ${interactions.map((interaction) => `<span class="st-canvas-caption">${interaction}</span>`).join('')}
            ${rows
              .map(
                ({ state, cells }) =>
                  `<span class="st-canvas-caption st-canvas-row-caption">${state}</span>` +
                  cells.map((drawn) => `<div class="st-canvas-cell">${drawn.body}</div>`).join(''),
              )
              .join('')}
          </div>
        </figure>
        <div class="st-canvas-zoom"><span>Fit</span><span class="st-canvas-zoom-value">${zoom}</span></div>
      </div>`,
      styles: first?.styles + styles,
    });
  },
});
