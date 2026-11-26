import { css, drawing, html } from '@design-explore';
import { ACCENT, CENTER, GROUND, INK, LINE, MUTED, SIZE, VALUE, frameStyles, pad, point } from './fixture';

const outer = Array.from({ length: 12 }, (_, step) => ({ step, label: step === 0 ? '12' : String(step), radius: 108 }));
const inner = Array.from({ length: 12 }, (_, step) => ({ step, label: pad(step === 0 ? 0 : step + 12), radius: 74 }));
const at = point(VALUE.hour % 12, 12, 74);

const numbers = [...outer, ...inner]
  .map(({ step, label, radius }) => {
    const spot = point(step, 12, radius);
    const isSelected = label === pad(VALUE.hour);
    return `<text class="${radius === 74 ? 'inner' : ''} ${isSelected ? 'on' : ''}" x="${spot.x}" y="${spot.y}">${label}</text>`;
  })
  .join('');

export default drawing({
  body: html`
    <div class="trigger">
      <span class="field active">${pad(VALUE.hour)}</span>
      <span class="colon">:</span>
      <span class="field">${pad(VALUE.minute)}</span>
    </div>
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        <circle class="face" cx="${CENTER}" cy="${CENTER}" r="130" />
        <line class="hand" x1="${CENTER}" y1="${CENTER}" x2="${at.x}" y2="${at.y}" />
        <circle class="pivot" cx="${CENTER}" cy="${CENTER}" r="3" />
        <circle class="handle" cx="${at.x}" cy="${at.y}" r="16" />
        ${numbers}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .colon {
      color: ${MUTED};
    }

    .face {
      fill: ${LINE};
    }

    .hand {
      stroke: ${ACCENT};
      stroke-width: 2;
    }

    .pivot,
    .handle {
      fill: ${ACCENT};
    }

    .handle {
      stroke: ${GROUND};
      stroke-width: 0;
    }

    svg text {
      fill: ${INK};
      font-size: 14px;
    }

    svg text.inner {
      fill: ${MUTED};
      font-size: 12px;
    }

    svg text.on {
      fill: #10131a;
      font-weight: 600;
    }
  `,
});
