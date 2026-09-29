import { css, drawing, html } from '@design-explore';
import {
  ACCENT,
  NOW_MINUTE,
  PANEL,
  SIZE,
  arcPath,
  frameStyles,
  hint,
  readoutStyles,
  ringBase,
  ringStyles,
  trackAt,
  trigger,
} from './fixture';

const from = trackAt(NOW_MINUTE);
const to = trackAt(NOW_MINUTE + 60);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <path class="ghost-arc" d="${arcPath(NOW_MINUTE, NOW_MINUTE + 60, 112)}" />
        <circle class="ghost" cx="${from.x}" cy="${from.y}" r="12" />
        <circle class="ghost" cx="${to.x}" cy="${to.y}" r="12" />
        ${hint('14:10', 'now, drag to set')}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
    ${readoutStyles}

    .ghost-arc {
      fill: none;
      stroke: ${ACCENT};
      stroke-width: 28;
      opacity: 0.15;
    }

    .ghost {
      fill: ${PANEL};
      stroke: ${ACCENT};
      stroke-width: 2;
      stroke-dasharray: 3 3;
    }

    svg text.readout {
      opacity: 0.5;
    }
  `,
});
