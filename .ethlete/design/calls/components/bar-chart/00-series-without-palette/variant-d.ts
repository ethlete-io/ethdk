import { css, drawing, html } from '@design-explore';
import { ACCENT, SURFACE, figure, frameStyles, legend, plot } from './fixture';

const defs = html`
  <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="${ACCENT}" />
    <line x1="0" y1="0" x2="0" y2="6" stroke="${SURFACE}" stroke-width="2" />
  </pattern>
  <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
    <rect width="5" height="5" fill="${ACCENT}" />
    <circle cx="2.5" cy="2.5" r="1.1" fill="${SURFACE}" />
  </pattern>
`;

const fills = [ACCENT, 'url(#hatch)', 'url(#dots)'];

const swatches = [
  ACCENT,
  `repeating-linear-gradient(45deg, ${ACCENT} 0 2.2px, ${SURFACE} 2.2px 3.6px)`,
  `radial-gradient(circle, ${SURFACE} 0 1px, transparent 1.2px) 0 0 / 5px 5px, ${ACCENT}`,
];

export default drawing({
  body: html`${legend(swatches)} ${figure(plot(fills, defs))}`,
  styles: css`
    ${frameStyles}
  `,
});
