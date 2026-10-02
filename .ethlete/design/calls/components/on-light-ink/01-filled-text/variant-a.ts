import { drawing } from '@design-explore';
import { NEUTRAL_900, SHIPPED, frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({
    ...SHIPPED,
    success: { fill: SHIPPED.success.fill, text: NEUTRAL_900 },
    warning: { fill: SHIPPED.warning.fill, text: NEUTRAL_900 },
  }),
  styles: frameStyles,
});
