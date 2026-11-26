import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ muted: [115, 115, 115], secondaryInTint: 'text' }),
  styles: frameStyles,
});
