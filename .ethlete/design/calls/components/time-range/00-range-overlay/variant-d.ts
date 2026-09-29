import { css, drawing, html } from '@design-explore';
import { frameStyles, trigger12h } from './fixture';
import { LABELS_12H } from './labels-12h';
import { ring, ringStyles } from './ring';

export default drawing({
  body: html`
    ${trigger12h}
    <div class="panel">${ring(LABELS_12H)}</div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
  `,
});
