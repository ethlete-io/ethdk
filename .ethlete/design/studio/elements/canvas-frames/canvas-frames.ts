import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './canvas-frames.css?inline';

type Props = { part: string; states: string[]; zoom: string };

const buttonStates = {
  filled: { label: 'Save', variant: 'filled' },
  outline: { label: 'Save', variant: 'outline' },
  tonal: { label: 'Save', variant: 'tonal' },
} as const;

const interactions = ['rest', 'hover', 'active', 'focus-visible', 'pressed', 'disabled'] as const;

const forced = (markup: string, interaction: (typeof interactions)[number]) => {
  if (interaction === 'disabled') return markup.replace(/^(\s*<\w+)/u, '$1 disabled aria-disabled="true"');
  if (interaction === 'hover' || interaction === 'active' || interaction === 'focus-visible')
    return markup.replace(/^(\s*<\w+)/u, `$1 data-et-force="${interaction}"`);

  return markup;
};

export const defaultFrames: Props = {
  part: 'button',
  states: ['filled', 'outline', 'tonal'],
  zoom: '100%',
};

export default definePart<Props>({
  note: 'The frames of one part on the canvas as a grid, one row per state and one column per interaction, and the zoom chip in the corner. It fills its container and leaves room for a side panel through --st-shell-inset-left.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    default: defaultFrames,
  },
  render: async ({ part, states, zoom }) => {
    const rows = await Promise.all(
      states.map(async (state) => {
        const base = buttonStates[state as keyof typeof buttonStates];
        const cells = await Promise.all(
          interactions.map(async (interaction) => {
            const drawn = await button.render(interaction === 'pressed' ? { ...base, pressed: true } : base);
            return { interaction, drawn };
          }),
        );
        return { state, cells };
      }),
    );
    const first = rows[0]?.cells[0]?.drawn;
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
                  cells
                    .map(
                      ({ interaction, drawn }) =>
                        `<div class="st-canvas-cell">${forced(drawn.body, interaction)}</div>`,
                    )
                    .join(''),
              )
              .join('')}
          </div>
        </figure>
        <div class="st-canvas-zoom"><span>Fit</span><span class="st-canvas-zoom-value">${zoom}</span></div>
      </div>`,
      styles: tokens + first?.styles + styles,
    });
  },
});
