import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ brand: [4, 120, 87], warning: [180, 83, 9] }),
  styles: frameStyles,
});
