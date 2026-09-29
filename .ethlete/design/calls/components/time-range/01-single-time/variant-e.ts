import { css, drawing, html } from '@design-explore';
import {
  ACCENT,
  CENTER,
  GROUND,
  LINE,
  MUTED,
  SIZE,
  VALUE,
  frameStyles,
  pad,
  point,
  ringStyles,
  trigger,
} from './fixture';
import { hourRing } from './hour-ring';

const MINUTES = [0, 15, 30, 45];

const minuteDial = MINUTES.map((minute) => {
  const at = point(minute, 60, 44);
  const on = minute === VALUE.minute;
  return `${on ? `<circle class="minute-handle" cx="${at.x}" cy="${at.y}" r="11" />` : ''}<text class="minute ${on ? 'on' : ''}" x="${at.x}" y="${at.y}">${pad(minute)}</text>`;
}).join('');

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${hourRing()}
        <circle class="minute-track" cx="${CENTER}" cy="${CENTER}" r="44" />
        ${minuteDial}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    .minute-track {
      fill: none;
      stroke: ${LINE};
      stroke-width: 22;
    }

    .minute-handle {
      fill: ${ACCENT};
      stroke: ${GROUND};
      stroke-width: 2;
    }

    svg text.minute {
      fill: ${MUTED};
      font-size: 10px;
    }

    svg text.minute.on {
      fill: #10131a;
      font-weight: 600;
    }
  `,
});
