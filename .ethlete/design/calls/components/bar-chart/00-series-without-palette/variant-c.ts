import { css, drawing, html } from '@design-explore';
import { ACCENT, SERIES, SURFACE, figure, frameStyles, legend, plot } from './fixture';

const MIN_ACCENT_MIX = 40;

const fills = SERIES.map((_, step) => {
  const mix = Math.round(100 - (step * (100 - MIN_ACCENT_MIX)) / (SERIES.length - 1));
  return `color-mix(in srgb, ${ACCENT} ${mix}%, ${SURFACE})`;
});

export default drawing({
  body: html`${legend(fills)} ${figure(plot(fills))}`,
  styles: css`
    ${frameStyles}
  `,
});
