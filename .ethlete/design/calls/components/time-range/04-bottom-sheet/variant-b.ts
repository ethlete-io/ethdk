import { css, drawing, html } from '@design-explore';
import { ACCENT, INK, LINE, MUTED, RANGE, SIZE, frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="scrim"></div>
    <div class="sheet">
      <div class="grab"></div>
      <div class="ends">
        <button class="end">
          <span class="caption">From</span>
          <span class="time">${RANGE.fromLabel}</span>
        </button>
        <button class="end active">
          <span class="caption">To</span>
          <span class="time">${RANGE.toLabel}</span>
        </button>
      </div>
      ${ring(SIZE, 12, true)}
    </div>
  `,
  styles: css`
    ${frameStyles}

    .ends {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      margin-bottom: 1.6rem;
    }

    .end {
      display: grid;
      gap: 0.2rem;
      min-height: 5.6rem;
      padding: 0.8rem 1.2rem;
      border: 1px solid ${LINE};
      border-radius: 1rem;
      background: none;
      color: ${INK};
      font: inherit;
      text-align: left;
    }

    .end.active {
      border-color: ${ACCENT};
      box-shadow: inset 0 0 0 1px ${ACCENT};
    }

    .caption {
      color: ${MUTED};
      font-size: 1.2rem;
    }

    .time {
      font-size: 2rem;
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
  `,
});
