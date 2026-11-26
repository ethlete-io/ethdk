import { css, drawing } from '@design-explore';
import { charts, crosshair, frameStyles, slicePoints } from './fixture';

export default drawing({
  body: charts((ctx) => ({
    svg: `<rect class="ring" x="${ctx.start}" y="0" width="${ctx.width}" height="${ctx.height}" rx="4" />${crosshair(ctx)}${slicePoints(ctx)}`,
  })),
  styles: css`
    ${frameStyles}

    .ring {
      fill: color-mix(in srgb, var(--et-surface-interaction) 6%, transparent);
      stroke: var(--et-tone-fill);
      stroke-width: 2px;
    }
  `,
});
