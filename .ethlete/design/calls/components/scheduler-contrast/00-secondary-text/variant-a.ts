import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ titleWeight: 400, secondaryOpacity: 0.75, secondary: 'ink' }),
  styles: frameStyles,
});
