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

const chevron = (y: number, up: boolean) =>
  `<path class="chevron" d="M ${CENTER - 6} ${y + (up ? 3 : -3)} L ${CENTER} ${y + (up ? -3 : 3)} L ${CENTER + 6} ${y + (up ? 3 : -3)}" />`;

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="pad" cx="${CENTER}" cy="${CENTER}" r="58" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
        ${chevron(CENTER - 40, true)} ${readout('swipe · 5 min')} ${chevron(CENTER + 40, false)}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .pad {
      fill: ${LINE};
      opacity: 0.5;
    }

    .chevron {
      fill: none;
      stroke: ${MUTED};
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
});
