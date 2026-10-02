import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ elevated2: [180, 180, 180], elevated3: [212, 212, 212] }),
  styles: frameStyles,
});
