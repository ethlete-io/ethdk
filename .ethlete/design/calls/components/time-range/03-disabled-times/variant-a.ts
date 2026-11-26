import { css, drawing, html } from '@design-explore';
import {
  DISABLED,
  LINE,
  PANEL,
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
const cuts = DISABLED.map(
  ({ from, to }) =>
    `<path class="cut" d="${arcPath(from, to, 112)}" /><path class="thin" d="${arcPath(from, to, 112)}" />`,
).join('');

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()} ${cuts}
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

    .cut {
      fill: none;
      stroke: ${PANEL};
      stroke-width: 30;
    }

    .thin {
      fill: none;
      stroke: ${LINE};
      stroke-width: 6;
    }
  `,
});
