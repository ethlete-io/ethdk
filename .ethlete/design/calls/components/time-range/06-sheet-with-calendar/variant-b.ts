import { css, drawing, html } from '@design-explore';
import { LINE, calendar, frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="scrim"></div>
    <div class="sheet">
      <div class="grab"></div>
      <div class="scroll">
        ${calendar()}
        <div class="time">${ring()}</div>
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .sheet {
      top: 6.4rem;
      padding-bottom: 0;
    }

    .scroll {
      height: calc(100% - 2rem);
      overflow: hidden;
    }

    .time {
      margin-top: 1.6rem;
      padding-top: 1.6rem;
      border-top: 1px solid ${LINE};
    }
  `,
});
