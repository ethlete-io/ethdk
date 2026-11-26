import { css, drawing, html } from '@design-explore';
import {
  ACCENT,
  CENTER,
  LINE,
  MUTED,
  SIZE,
  VALUE,
  frameStyles,
  pad,
  point,
  ringBase,
  ringStyles,
  trigger,
} from './fixture';

const at = point(VALUE.hour, 24, 112);
const MINUTES = [0, 15, 30, 45];

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <line class="hand" x1="${CENTER}" y1="${CENTER}" x2="${at.x}" y2="${at.y}" />
        <circle class="pivot" cx="${CENTER}" cy="${CENTER}" r="3" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
      </svg>
      <div class="chips">
        ${MINUTES.map(
          (minute) => html`<span class="chip ${minute === VALUE.minute ? 'selected' : ''}">:${pad(minute)}</span>`,
        )}
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    .chips {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.6rem;
      margin-top: 1.2rem;
    }

    .chip {
      padding: 0.6rem;
      border: 1px solid ${LINE};
      border-radius: 0.6rem;
      text-align: center;
      font-size: 1.3rem;
      font-variant-numeric: tabular-nums;
      color: ${MUTED};
    }

    .chip.selected {
      border-color: ${ACCENT};
      background: ${ACCENT};
      color: #10131a;
      font-weight: 600;
    }
  `,
});
