import { css, drawing, html } from '@design-explore';
import { ACCENT, CENTER, LINE, MUTED, SIZE, VALUE, frameStyles, pad, point, ringStyles } from './fixture';

const ticks = Array.from({ length: 60 }, (_, minute) => {
  const outer = point(minute, 60, 94);
  const inner = point(minute, 60, minute % 5 === 0 ? 88 : 91);
  return `<line x1="${outer.x}" y1="${outer.y}" x2="${inner.x}" y2="${inner.y}" />`;
}).join('');

const labels = Array.from({ length: 12 }, (_, index) => {
  const at = point(index * 5, 60, 74);
  return `<text x="${at.x}" y="${at.y}">${pad(index * 5)}</text>`;
}).join('');

const at = point(VALUE.minute, 60, 112);

export default drawing({
  body: html`
    <div class="trigger">
      <span class="field">${pad(VALUE.hour)}</span>
      <span class="colon">:</span>
      <span class="field active">${pad(VALUE.minute)}</span>
    </div>
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        <circle class="track" cx="${CENTER}" cy="${CENTER}" r="112" />
        <g class="ticks">${ticks}</g>
        <g class="labels">${labels}</g>
        <text class="mode" x="${CENTER}" y="${CENTER}">minutes</text>
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    .colon {
      color: ${MUTED};
    }

    svg text.mode {
      fill: ${MUTED};
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .track {
      stroke: ${LINE};
    }

    .handle {
      fill: ${ACCENT};
    }
  `,
});
