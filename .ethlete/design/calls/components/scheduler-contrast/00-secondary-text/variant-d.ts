import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ titleWeight: 400, secondaryOpacity: 1, secondary: 'surface' }),
  styles: frameStyles,
});
