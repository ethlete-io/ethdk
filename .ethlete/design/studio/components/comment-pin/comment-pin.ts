import { definePart, drawing } from '@design-system';
import { grid, pin, type Props, states } from './shared/comment-pin';
import styles from './comment-pin.css?inline';

export type { Props } from './shared/comment-pin';

export const commentPinMark = (props: Props) => pin(props);
export const commentPinStyles = styles;

export default definePart({
  note: "Merged variant a of Count alignment: the count is a badge on the teardrop's head.",
  madeBy: ['claude-opus-5-5'],
  states,
  grid,
  render: (props: Props) => drawing({ body: `<span class="st-pin-stage">${commentPinMark(props)}</span>`, styles }),
});
