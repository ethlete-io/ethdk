import { css, drawing, html } from '@design-explore';
import { CENTER, LINE, LONG_RANGE, calendar, frameStyles, ring, triggerFor } from './fixture';

const centre = `
  <text class="big" x="${CENTER}" y="${CENTER - 4}">06:30</text>
  <text class="note" x="${CENTER}" y="${CENTER + 20}">Fri 16 Oct</text>
`;

export default drawing({
  body: html`
    ${triggerFor(LONG_RANGE)}
    <div class="panel">
      ${calendar(LONG_RANGE)}
      <div class="time">${ring(LONG_RANGE, centre)}</div>
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
