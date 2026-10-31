import { selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing } from '@design-system';
import styles from './select.css?inline';
import { grid, moreStates, selectBody, SelectProps, states } from './shared/select-part';

export default definePart<SelectProps>({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: { ...states, ...moreStates },
  grid,
  widths: [320],
  controls: {
    select: { kind: 'select', input: ['pointer', 'keyboard'], disabled: true, surfaces: { open: 'open' } },
  },
  render: (props) => drawing({ body: selectBody(props), styles: [selectStyles, styles].join('\n') }),
});
