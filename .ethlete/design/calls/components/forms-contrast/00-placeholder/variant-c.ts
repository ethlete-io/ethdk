import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ placeholder: 'mix', amount: 0.6 }),
  styles: frameStyles,
});
