import { drawing } from '@design-explore';
import { AXIS_DAY_STYLES, axisDay } from './axis-day';

export default drawing({
  body: axisDay('hour'),
  styles: AXIS_DAY_STYLES,
});
