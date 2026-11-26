import { drawing } from '@design-explore';
import { BREAK_DAY_STYLES, breakDay } from './day-shell';

export default drawing({
  body: breakDay({ mode: 'gutter' }),
  styles: BREAK_DAY_STYLES,
});
