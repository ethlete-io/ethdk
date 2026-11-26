import { css, drawing, html } from '@design-explore';
import { MUTED, frameStyles, trigger12h } from './fixture';
import { LABELS_12H } from './labels-12h';
import { point, ring, ringStyles } from './ring';

const moonAt = point(0, 46);
const sunAt = point(12, 46);

const moon = `<path class="mark" transform="translate(${moonAt.x - 6} ${moonAt.y - 6})" d="M8.5 0.8 A6 6 0 1 0 11.2 8.6 A4.6 4.6 0 0 1 8.5 0.8 Z" />`;

const rays = Array.from({ length: 8 }, (_, index) => {
  const angle = (index / 8) * Math.PI * 2;
  const inner = { x: sunAt.x + 5.2 * Math.cos(angle), y: sunAt.y + 5.2 * Math.sin(angle) };
  const outer = { x: sunAt.x + 7.6 * Math.cos(angle), y: sunAt.y + 7.6 * Math.sin(angle) };
  return `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" />`;
}).join('');

const sun = `<g class="sun"><circle cx="${sunAt.x}" cy="${sunAt.y}" r="3.2" />${rays}</g>`;

export default drawing({
  body: html`
    ${trigger12h}
    <div class="panel">${ring(LABELS_12H, moon + sun)}</div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    .mark {
      fill: ${MUTED};
    }

    .sun circle {
      fill: ${MUTED};
    }

    .sun line {
      stroke: ${MUTED};
      stroke-width: 1.2;
      stroke-linecap: round;
    }
  `,
});
