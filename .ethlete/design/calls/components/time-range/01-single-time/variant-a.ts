import { css, drawing, html } from '@design-explore';
import { ACCENT, MUTED, VALUE, frameStyles, pad, trigger } from './fixture';

const HOURS = [11, 12, 13, 14, 15, 16, 17];
const MINUTES = [0, 15, 30, 45];

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <div class="columns">
        <div class="column">
          ${HOURS.map((hour) => html`<span class="option ${hour === VALUE.hour ? 'selected' : ''}">${pad(hour)}</span>`)}
        </div>
        <div class="column">
          ${MINUTES.map(
            (minute) => html`<span class="option ${minute === VALUE.minute ? 'selected' : ''}">${pad(minute)}</span>`,
          )}
        </div>
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
    }

    .column {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .option {
      padding: 0.6rem;
      border-radius: 0.6rem;
      text-align: center;
      font-size: 1.4rem;
      font-variant-numeric: tabular-nums;
      color: ${MUTED};
    }

    .option.selected {
      background: ${ACCENT};
      color: #10131a;
      font-weight: 600;
    }
  `,
});
