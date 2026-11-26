import { css, drawing, html } from '@design-explore';
import { PALETTE, chartPair, codeBlock, frameStyles } from './fixture';

const DARK_PICKS = ['#7aa2ff', '#3cc3b4', '#b98cf0'];

const code = `provideColorPalette({
  default: [{ token: 'blue' }, { token: 'teal' }, { token: 'purple' }],
  'dark-card': [{ token: 'blue-bright' }, { token: 'teal-bright' }, { token: 'purple-bright' }],
});`;

export default drawing({
  body: html`
    ${chartPair(PALETTE, DARK_PICKS)}
    ${codeBlock(
      code,
      "The keys are surface theme names, and 'dark-card' and every token are this example app's own registrations.",
    )}
  `,
  styles: css`
    ${frameStyles}
  `,
});
