import { css, drawing, html } from '@design-explore';
import {
  CENTER,
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

const nudge = (x: number, label: string) => `
  <rect class="nudge" x="${x - 15}" y="${CENTER + 28}" width="30" height="20" rx="6" />
  <text class="nudge-label" x="${x}" y="${CENTER + 38}">${label}</text>
`;

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
        ${readout('drag · 15 min')} ${nudge(CENTER - 18, '−5')} ${nudge(CENTER + 18, '+5')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .nudge {
      fill: none;
      stroke: ${LINE};
      stroke-width: 1;
    }

    svg text.nudge-label {
      fill: ${MUTED};
      font-size: 11px;
    }
  `,
});
