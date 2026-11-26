import { css, drawing, html } from '@design-explore';
import { SIZE, frameStyles, ring, trigger } from './fixture';

const WIDTH = 328;
const HANDLE = (22 * SIZE) / WIDTH;

export default drawing({
  body: html`
    ${trigger}
    <div class="scrim"></div>
    <div class="sheet">
      <div class="grab"></div>
      ${ring(WIDTH, HANDLE, false)}
    </div>
  `,
  styles: css`
    ${frameStyles}
  `,
});
