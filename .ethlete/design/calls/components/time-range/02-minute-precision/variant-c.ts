import { css, drawing, html } from '@design-explore';
import {
  ACCENT,
  CENTER,
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
const WIDTH = 72;
const left = CENTER - WIDTH / 2;
const scaleY = CENTER + 38;

const scale = Array.from({ length: 7 }, (_, index) => {
  const x = left + (index / 6) * WIDTH;
  const major = index % 3 === 1;
  return `<line x1="${x}" y1="${scaleY - (major ? 6 : 3)}" x2="${x}" y2="${scaleY + (major ? 6 : 3)}" />`;
}).join('');

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="halo" cx="${at.x}" cy="${at.y}" r="22" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="13" />
        ${readout('slow · 5 min')}
        <g class="scale">${scale}</g>
        <circle class="marker" cx="${left + (4 / 6) * WIDTH}" cy="${scaleY}" r="4" />
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .scale line {
      stroke: ${MUTED};
      stroke-width: 1;
    }

    .marker {
      fill: ${ACCENT};
    }

    svg text.edge {
      fill: ${MUTED};
      font-size: 10px;
    }
  `,
});
