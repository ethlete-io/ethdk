import { css, drawing, html } from '@design-explore';
import {
  ACCENT_SOFT,
  CENTER,
  INK,
  MUTED,
  SIZE,
  VALUE,
  frameStyles,
  point,
  ringBase,
  ringStyles,
  trigger,
} from './fixture';

const at = point(VALUE.hour * 60 + VALUE.minute, 24 * 60, 112);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <circle class="halo" cx="${at.x}" cy="${at.y}" r="22" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="13" />
        <text class="readout" x="${CENTER}" y="${CENTER - 4}">${VALUE.label}</text>
        <text class="step" x="${CENTER}" y="${CENTER + 20}">15 min steps</text>
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    .halo {
      fill: ${ACCENT_SOFT};
    }

    svg text.readout {
      fill: ${INK};
      font-size: 28px;
      font-weight: 500;
    }

    svg text.step {
      fill: ${MUTED};
      font-size: 11px;
    }
  `,
});
