import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ text: 'primary' }),
  styles: frameStyles,
});
