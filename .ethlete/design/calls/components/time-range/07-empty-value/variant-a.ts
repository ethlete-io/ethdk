import { css, drawing, html } from '@design-explore';
import { SIZE, frameStyles, hint, readoutStyles, ringBase, ringStyles, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()} ${hint('--:--', 'tap the ring')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}
  `,
});
