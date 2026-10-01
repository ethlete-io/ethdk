import { css, drawing } from '@design-explore';
import { charts, crosshair, frameStyles, slicePoints } from './fixture';

const MIN_WIDTH = 12;

export default drawing({
  body: charts((ctx) => {
    const width = Math.max(ctx.width, MIN_WIDTH);
    return {
      svg: `<rect class="ring" x="${ctx.x - width / 2}" y="0" width="${width}" height="${ctx.height}" rx="4" />${crosshair(ctx)}${slicePoints(ctx)}`,
    };
  }),
  styles: css`
    ${frameStyles}

    .ring {
      fill: color-mix(in srgb, var(--et-surface-interaction-solid) 6%, transparent);
      stroke: var(--et-theme-color-primary-solid);
      stroke-width: 2px;
    }
  `,
});
