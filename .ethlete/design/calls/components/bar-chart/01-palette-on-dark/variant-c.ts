import { css, drawing, html } from '@design-explore';
import { PALETTE, chartPair, codeBlock, frameStyles } from './fixture';

const ON_DARK = ['#7aa2ff', '#3cc3b4', '#b98cf0'];

const code = `provideColorPalette([
  { token: 'blue', onDark: 'blue-bright' },
  { token: 'teal', onDark: 'teal-bright' },
  { token: 'purple', onDark: 'purple-bright' },
]);`;

export default drawing({
  body: html`
    ${chartPair(PALETTE, ON_DARK)}
    ${codeBlock(code, "The chart reads the surface's dark or light kind and picks the entry's theme for it.")}
  `,
  styles: css`
    ${frameStyles}
  `,
});
