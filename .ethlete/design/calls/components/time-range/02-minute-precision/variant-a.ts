import { css, drawing, html } from '@design-explore';
import {
  MINUTE_OF_DAY,
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
        <circle class="halo" cx="${at.x}" cy="${at.y}" r="22" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="13" />
        ${readout('5 min steps')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}
  `,
});
