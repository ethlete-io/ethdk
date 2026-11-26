import { css, drawing } from '@design-explore';
import { chartPair, frameStyles, shippedLayer } from './fixture';

export default drawing({
  body: chartPair(shippedLayer),
  styles: css`
    ${frameStyles}

    .et-surface--dark {
      --et-surface-chart-area-opacity: 0.6;
    }

    .area {
      fill-opacity: var(--et-surface-chart-area-opacity, 0.32);
    }
  `,
});
