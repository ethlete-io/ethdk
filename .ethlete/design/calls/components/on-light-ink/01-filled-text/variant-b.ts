import { drawing } from '@design-explore';
import { SHIPPED, WHITE, frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({
    ...SHIPPED,
    success: { fill: [21, 128, 61], text: WHITE },
    warning: { fill: [180, 83, 9], text: WHITE },
  }),
  styles: frameStyles,
});
