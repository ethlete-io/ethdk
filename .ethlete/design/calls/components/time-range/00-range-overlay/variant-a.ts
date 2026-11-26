import { css, drawing, html } from '@design-explore';
import { ACCENT, ACCENT_SOFT, INK, LINE, MUTED, RANGE, frameStyles, hourLabel, trigger } from './fixture';

const HOURS = [3, 4, 5, 6, 7, 8, 9];
const MINUTES = [0, 15, 30, 45];

const inRange = (hour: number) => hour >= RANGE.from || hour < Math.floor(RANGE.to);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <div class="toggle">
        <span>From</span>
        <span class="on">To</span>
      </div>
      <div class="columns">
        <div class="column">
          ${HOURS.map(
            (hour) =>
              html`<span class="option ${hour === 6 ? 'selected' : inRange(hour) ? 'ranged' : ''}"
                >${hourLabel(hour)}</span
              >`,
          )}
        </div>
        <div class="column">
          ${MINUTES.map(
            (minute) =>
              html`<span class="option ${minute === 30 ? 'selected' : minute < 30 ? 'ranged' : ''}"
                >${hourLabel(minute)}</span
              >`,
          )}
        </div>
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      overflow: hidden;
      font-size: 1.3rem;
      text-align: center;
    }

    .toggle span {
      padding: 0.6rem;
      color: ${MUTED};
    }

    .toggle .on {
      background: ${ACCENT_SOFT};
      color: ${INK};
    }

    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      margin-top: 1.2rem;
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

    .option.ranged {
      background: ${ACCENT_SOFT};
      color: ${INK};
    }

    .option.selected {
      background: ${ACCENT};
      color: #10131a;
      font-weight: 600;
    }
  `,
});
