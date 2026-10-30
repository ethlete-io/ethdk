import { definePart, drawing } from '@design-system';
import { grid, pin, type Props, states } from './shared/comment-pin';

export type { Props } from './shared/comment-pin';

export const commentPinMark = (props: Props) => pin(props);

export default definePart({
  note: "Merged variant a of Count alignment: the count is a badge on the teardrop's head.",
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  styles: '',
  states,
  grid,
  render: (props: Props) => drawing({ body: `<span class="inline-flex p-space-2">${commentPinMark(props)}</span>` }),
});
