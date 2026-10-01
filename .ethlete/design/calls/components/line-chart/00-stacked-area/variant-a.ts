import { css, drawing } from '@design-explore';
import { chartPair, frameStyles, shippedLayer } from './fixture';

export default drawing({
  body: chartPair(shippedLayer),
  styles: css`
    ${frameStyles}

    .area {
      fill-opacity: 0.32;
    }
  `,
});
