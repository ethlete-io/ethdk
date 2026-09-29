import { css, drawing, html } from '@design-explore';
import {
  DISABLED,
  MUTED,
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
const hatched = DISABLED.map(({ from, to }) => `<path class="hatch" d="${arcPath(from, to, 112)}" />`).join('');

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
        ${ringBase()} ${hatched}
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

    pattern line {
      stroke: ${MUTED};
      stroke-width: 1.5;
      opacity: 0.45;
    }

    .hatch {
      fill: none;
      stroke: url(#hatch);
      stroke-width: 28;
    }
  `,
});
