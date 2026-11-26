import { drawing } from '@design-explore';
import { frameStyles, sheet } from './fixture';

export default drawing({
  body: sheet({ tone: 'muted', weight: 300, shade: 0 }),
  styles: frameStyles,
});
