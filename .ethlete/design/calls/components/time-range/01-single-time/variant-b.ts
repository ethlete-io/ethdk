import { css, drawing, html } from '@design-explore';
import { CENTER, SIZE, VALUE, frameStyles, point, ringBase, ringStyles, trigger } from './fixture';

const at = point(VALUE.hour * 60 + VALUE.minute, 24 * 60, 112);

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${ringBase()}
        <line class="hand" x1="${CENTER}" y1="${CENTER}" x2="${at.x}" y2="${at.y}" />
        <circle class="pivot" cx="${CENTER}" cy="${CENTER}" r="3" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}
  `,
});
