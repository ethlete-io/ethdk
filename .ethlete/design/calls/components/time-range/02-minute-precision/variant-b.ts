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

const onRing = point(MINUTE_OF_DAY, 24 * 60, 112);
const finger = point(MINUTE_OF_DAY, 24 * 60, 136);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="fine" cx="${CENTER}" cy="${CENTER}" r="136" />
        <line class="tether" x1="${onRing.x}" y1="${onRing.y}" x2="${finger.x}" y2="${finger.y}" />
        <circle class="handle" cx="${onRing.x}" cy="${onRing.y}" r="9" />
        <circle class="finger" cx="${finger.x}" cy="${finger.y}" r="11" />
        ${readout('fine · 5 min')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    svg {
      overflow: visible;
    }

    .fine {
      fill: none;
      stroke: ${MUTED};
      stroke-width: 1;
      stroke-dasharray: 2 4;
    }

    .tether {
      stroke: ${ACCENT};
      stroke-width: 2;
    }

    .finger {
      fill: none;
      stroke: ${ACCENT};
      stroke-width: 2;
    }
  `,
});
