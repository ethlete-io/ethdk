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
      flex-direction: column;
    }

    .time {
      margin-top: 1.2rem;
      padding-top: 1.2rem;
      border-top: 1px solid ${LINE};
    }
  `,
});
