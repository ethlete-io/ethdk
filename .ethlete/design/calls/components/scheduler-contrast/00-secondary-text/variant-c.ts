import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ titleWeight: 600, secondaryOpacity: 1, secondary: 'ink' }),
  styles: frameStyles,
});
