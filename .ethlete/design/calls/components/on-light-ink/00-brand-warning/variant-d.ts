import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ brand: [4, 120, 87], warning: [146, 64, 14] }),
  styles: frameStyles,
});
