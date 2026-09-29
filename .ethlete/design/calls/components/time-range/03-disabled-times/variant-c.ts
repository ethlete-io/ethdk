import { css, drawing, html } from '@design-explore';
import {
  CENTER,
  LINE,
  SIZE,
  arcPath,
  frameStyles,
  handleAt,
  readout,
  readoutStyles,
  ringBase,
  ringStyles,
  trigger,
} from './fixture';

const at = handleAt();
const AVAILABLE = [
  { from: 8 * 60, to: 12 * 60 },
  { from: 13 * 60, to: 20 * 60 },
];
const bands = AVAILABLE.map(({ from, to }) => `<path class="band" d="${arcPath(from, to, 112)}" />`).join('');

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="gap" cx="${CENTER}" cy="${CENTER}" r="112" />
        ${bands}
        <circle class="halo" cx="${at.x}" cy="${at.y}" r="22" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="13" />
        ${readout('08:00 – 20:00')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .track {
      stroke: none;
    }

    .gap {
      fill: none;
      stroke: ${LINE};
      stroke-width: 1;
      stroke-dasharray: 2 5;
    }

    .band {
      fill: none;
      stroke: ${LINE};
      stroke-width: 28;
    }
  `,
});
