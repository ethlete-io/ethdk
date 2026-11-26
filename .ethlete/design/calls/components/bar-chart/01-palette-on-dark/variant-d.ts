import { css, drawing, html } from '@design-explore';
import { DARK, PALETTE, chartPair, codeBlock, frameStyles } from './fixture';

const LIFT = 35;

const lifted = PALETTE.map((color) => `color-mix(in oklab, ${color}, ${DARK.ink} ${LIFT}%)`);

const code = `provideColorPalette([{ token: 'blue' }, { token: 'teal' }, { token: 'purple' }]);

/* on a dark surface the chart draws each series as */
color-mix(in oklab, var(--series), var(--surface-ink) ${LIFT}%)`;

export default drawing({
  body: html`
    ${chartPair(PALETTE, lifted)} ${codeBlock(code, 'The app code is unchanged; the lift is the SDK default.')}
  `,
  styles: css`
    ${frameStyles}
  `,
});
