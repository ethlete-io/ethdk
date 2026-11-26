import { css, drawing, html } from '@design-explore';
import { PALETTE, chartPair, codeBlock, frameStyles } from './fixture';

const code = `provideColorPalette([{ token: 'blue' }, { token: 'teal' }, { token: 'purple' }]);`;

export default drawing({
  body: html`
    ${chartPair(PALETTE, PALETTE)}
    ${codeBlock(
      code,
      'To fix the dark side, the app provides a second palette on the dark region itself, next to its [etProvideSurface].',
    )}
  `,
  styles: css`
    ${frameStyles}
  `,
});
