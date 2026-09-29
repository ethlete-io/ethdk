import { css, html } from '@design-explore';

/** One time range: the same overnight value in every frame, with the "to" field focused. */
export const RANGE = { from: 22, to: 6.5, fromLabel: '22:00', toLabel: '06:30', duration: '8 h 30 min' };

export const GROUND = '#14161a';
export const PANEL = '#1d2026';
export const LINE = '#2e323a';
export const INK = '#e8e6e1';
export const MUTED = '#868b93';
export const ACCENT = '#8fa8ff';
export const ACCENT_SOFT = 'rgba(143, 168, 255, 0.22)';

export const hourLabel = (hour: number) => String(hour).padStart(2, '0');

export const trigger = html`
  <div class="trigger">
    <span class="field">${RANGE.fromLabel}</span>
    <span class="dash">–</span>
    <span class="field active">${RANGE.toLabel}</span>
  </div>
`;

export const frameStyles = css`
  html {
    font-size: 62.5%;
    background: ${GROUND};
  }

  #root {
    display: block;
    padding: 1.6rem;
    min-height: 46rem;
    background: ${GROUND};
    font-family: system-ui, sans-serif;
    color: ${INK};
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.8rem 1.2rem;
    border: 1px solid ${LINE};
    border-radius: 0.8rem;
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
  }

  .field {
    padding-bottom: 0.2rem;
    border-bottom: 2px solid transparent;
  }

  .field.active {
    border-bottom-color: ${ACCENT};
  }

  .dash {
    color: ${MUTED};
  }

  .panel {
    margin-top: 0.8rem;
    box-sizing: border-box;
    width: 32rem;
    padding: 1.6rem;
    border: 1px solid ${LINE};
    border-radius: 1.2rem;
    background: ${PANEL};
    box-shadow: 0 1.2rem 3.2rem rgba(0, 0, 0, 0.4);
  }
`;

/** The same range as `RANGE`, written for a 12h locale. */
export const RANGE_12H = { fromLabel: '10:00 PM', toLabel: '6:30 AM' };

export const trigger12h = html`
  <div class="trigger">
    <span class="field">${RANGE_12H.fromLabel}</span>
    <span class="dash">–</span>
    <span class="field active">${RANGE_12H.toLabel}</span>
  </div>
`;
