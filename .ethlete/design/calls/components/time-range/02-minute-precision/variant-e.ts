import { css, drawing, html } from '@design-explore';
import {
  LINE,
  MINUTE_OF_DAY,
  MUTED,
  SIZE,
  frameStyles,
  point,
  readout,
  readoutStyles,
  ringBase,
  ringStyles,
  trigger,
} from './fixture';

const at = point(MINUTE_OF_DAY, 24 * 60, 112);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
        ${readout('drag · 15 min')}
      </svg>
      <div class="nudges">
        <span class="nudge">−5 min</span>
        <span class="nudge">+5 min</span>
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .nudges {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      margin-top: 1.2rem;
    }

    .nudge {
      display: grid;
      place-items: center;
      height: 4.4rem;
      border: 1px solid ${LINE};
      border-radius: 0.8rem;
      font-size: 1.3rem;
      color: ${MUTED};
    }
  `,
});
