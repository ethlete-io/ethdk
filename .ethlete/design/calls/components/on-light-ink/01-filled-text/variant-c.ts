import { drawing } from '@design-explore';
import { NEUTRAL_900, SHIPPED, WHITE, frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({
    ...SHIPPED,
    success: { fill: [21, 128, 61], text: WHITE },
    warning: { fill: SHIPPED.warning.fill, text: NEUTRAL_900 },
  }),
  styles: frameStyles,
});
