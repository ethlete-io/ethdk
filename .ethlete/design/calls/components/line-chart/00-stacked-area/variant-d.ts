import { css, drawing, html } from '@design-explore';
import { BANDS, PLOT_HEIGHT, type SeriesLayer, chartPair, frameStyles } from './fixture';

const gradientLayer: SeriesLayer = (surface) =>
  BANDS.map((band) => {
    const id = `fade-${surface}-${band.key}`;

    return html`<g class="series et-color--${band.colorTheme}">
      <defs>
        <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${band.top}" x2="0" y2="${PLOT_HEIGHT}">
          <stop class="stop-top" offset="0" />
          <stop class="stop-base" offset="1" />
        </linearGradient>
      </defs>
      <path class="area" d="${band.areaPath}" style="fill: url(#${id})" />
      <path class="line" d="${band.linePath}" />
    </g>`;
  }).join('');

export default drawing({
  body: chartPair(gradientLayer),
  styles: css`
    ${frameStyles}

    stop {
      stop-color: var(--et-theme-color-primary-solid);
    }

    .stop-top {
      stop-opacity: 0.56;
    }

    .stop-base {
      stop-opacity: 0.08;
    }
  `,
});
