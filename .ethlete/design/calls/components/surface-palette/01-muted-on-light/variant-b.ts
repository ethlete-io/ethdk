import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ muted: [82, 82, 82], secondaryInTint: 'muted' }),
  styles: frameStyles,
});
