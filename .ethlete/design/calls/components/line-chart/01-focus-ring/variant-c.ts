import { css, drawing } from '@design-explore';
import { POINT_RADIUS, charts, crosshair, frameStyles, slicePoints } from './fixture';

const RING_RADIUS = POINT_RADIUS + 4;

export default drawing({
  body: charts((ctx) => ({
    svg: `${crosshair(ctx)}${slicePoints(ctx)}${ctx.points
      .map((p) => `<circle class="ring" cx="${ctx.x}" cy="${p.y}" r="${RING_RADIUS}" />`)
      .join('')}`,
  })),
  styles: css`
    ${frameStyles}

    .crosshair {
      stroke: var(--et-theme-color-primary-solid);
      stroke-width: 2px;
    }

    .ring {
      fill: none;
      stroke: var(--et-theme-color-primary-solid);
      stroke-width: 2px;
    }
  `,
});
