import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ brand: [6, 95, 70], warning: [146, 64, 14] }),
  styles: frameStyles,
});
