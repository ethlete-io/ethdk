import { css, drawing, html } from '@design-explore';
import {
  ACCENT,
  CENTER,
  LINE,
  MUTED,
  SIZE,
  frameStyles,
  readoutStyles,
  ringBase,
  ringStyles,
  trigger,
} from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <rect class="now" x="${CENTER - 36}" y="${CENTER - 18}" width="72" height="36" rx="18" />
        <text class="now-label" x="${CENTER}" y="${CENTER}">Now</text>
        <text class="step" x="${CENTER}" y="${CENTER + 34}">or tap the ring</text>
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .now {
      fill: none;
      stroke: ${LINE};
      stroke-width: 1;
    }

    svg text.now-label {
      fill: ${ACCENT};
      font-size: 14px;
      font-weight: 500;
    }

    svg text.step {
      fill: ${MUTED};
    }
  `,
});
