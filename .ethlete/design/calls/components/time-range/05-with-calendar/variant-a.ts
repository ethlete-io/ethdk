import { css, drawing, html } from '@design-explore';
import { LINE, calendar, frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      ${calendar()}
      <div class="time">${ring()}</div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .panel {
      align-items: center;
    }

    .time {
      margin-left: 1.2rem;
      padding-left: 1.2rem;
      border-left: 1px solid ${LINE};
    }
  `,
});
