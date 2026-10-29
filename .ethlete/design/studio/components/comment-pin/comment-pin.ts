import { definePart, drawing } from '@design-system';
import { grid, pin, type Props, states } from './shared/comment-pin';
import styles from './comment-pin.css?inline';

export type { Props } from './shared/comment-pin';

export default definePart({
  note: 'Selection by face, as the inbox draws it: an initials pin fills with the accent, a logo pin keeps its surface and takes an accent ring so the brand colour stays readable. The reply count is an accent pill beside the teardrop. Costs two selected looks to learn; the count widens the pin to the right.',
  madeBy: ['claude-opus-5-5'],
  states,
  grid,
  render: (props: Props) => drawing({ body: pin(props), styles }),
});
