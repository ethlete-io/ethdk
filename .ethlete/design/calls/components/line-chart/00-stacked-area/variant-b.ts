import { css, drawing, html } from '@design-explore';
import { BANDS, type SeriesLayer, chartPair, frameStyles } from './fixture';

const mixedLayer: SeriesLayer = () => html`
  ${BANDS.map((band) => html`<path class="series area et-color--${band.colorTheme}" d="${band.areaPath}" />`)}
  ${BANDS.map((band) => html`<path class="series line et-color--${band.colorTheme}" d="${band.linePath}" />`)}
`;

export default drawing({
  body: chartPair(mixedLayer),
  styles: css`
    ${frameStyles}

    .area {
      fill: color-mix(in oklab, var(--_color) 45%, var(--et-surface-background-solid));
    }
  `,
});
