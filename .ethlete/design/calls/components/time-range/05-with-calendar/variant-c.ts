import { css, drawing, html } from '@design-explore';
import { ACCENT, INK, LINE, MUTED, frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <div class="tabs">
        <span class="tab">
          <span class="caption">Dates</span>
          <span class="value">2 – 4 Oct</span>
        </span>
        <span class="tab active">
          <span class="caption">Times</span>
          <span class="value">22:00 – 06:30</span>
        </span>
      </div>
      ${ring()}
    </div>
  `,
  styles: css`
    ${frameStyles}

    .panel {
      flex-direction: column;
      width: 28rem;
    }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.4rem;
      margin-bottom: 1.2rem;
      padding: 0.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
    }

    .tab {
      display: grid;
      gap: 0.2rem;
      padding: 0.6rem 1rem;
      border-radius: 0.6rem;
      color: ${MUTED};
    }

    .tab.active {
      background: ${LINE};
      box-shadow: inset 0 -2px 0 ${ACCENT};
      color: ${INK};
    }

    .caption {
      font-size: 1.2rem;
    }

    .value {
      font-size: 1.4rem;
      font-variant-numeric: tabular-nums;
    }
  `,
});
