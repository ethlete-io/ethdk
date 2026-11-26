import { css, drawing, html } from '@design-explore';
import { SIZE, frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="scrim"></div>
    <div class="sheet">
      <div class="grab"></div>
      ${ring(SIZE, 12, true)}
    </div>
  `,
  styles: css`
    ${frameStyles}
  `,
});
