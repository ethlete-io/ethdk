import { css, drawing } from '@design-explore';
import { charts, crosshair, frameStyles, slicePoints } from './fixture';

const INSET = 6;

export default drawing({
  body: charts((ctx) => ({
    svg: `<rect class="ring" x="${-INSET}" y="${-INSET}" width="${ctx.plotWidth + INSET * 2}" height="${ctx.height + INSET * 2}" rx="6" />${crosshair(ctx)}${slicePoints(ctx)}`,
  })),
  styles: css`
    ${frameStyles}

    .ring {
      fill: none;
      stroke: var(--et-theme-color-primary-solid);
      stroke-width: 2px;
    }
  `,
});
