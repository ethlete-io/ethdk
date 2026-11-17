import { selectStyles } from '@ethlete/components/design/select';
import { definePart, drawing } from '@design-system';
import styles from './select.css?inline';
import { grid, moreStates, selectBody, SelectProps, states } from './shared/select-part';

export default definePart<SelectProps>({
  note: 'scale of the decided shape, Q182, lead merge',
  consumerAction: 'a form control whose value the consumer binds',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: { ...states, ...moreStates },
  describe: {
    placeholder:
      'A closed select with no value; check that the placeholder reads muted and the chevron sits at the end.',
    'placeholder-hover': 'The empty select hovered; check that the field border darkens.',
    'placeholder-active': 'The empty select pressed; check the press look on the field frame.',
    'placeholder-focus-visible': 'The empty select focused by keyboard; check that the focus ring wraps the field.',
    selected: 'A closed select showing In review; check that the value uses full text color.',
    'selected-hover': 'The filled select hovered; check that the border darkens and the value stays in place.',
    'selected-active': 'The filled select pressed; check the press look on the field frame.',
    'selected-focus-visible': 'The filled select focused by keyboard; check that the focus ring wraps the field.',
    disabled: 'The filled select disabled; check that field, value and chevron fade.',
    open: 'The select open on In review with Merged active by keyboard; check the panel under the field and the marks.',
    'open-option-hover':
      'The open select with Drafts under the pointer; check that the pointer highlight shows on Drafts.',
    'size-sm': 'The filled select at size sm; check that field and text shrink together.',
    'size-sm-hover': 'The size sm select hovered; check that the border darkens at the smaller field height.',
    'size-sm-active': 'The size sm select pressed; check the press look on the smaller field frame.',
    'size-sm-focus-visible':
      'The size sm select focused by keyboard; check that the focus ring wraps the smaller field.',
    'size-lg': 'The filled select at size lg; check that field and text grow together.',
    'size-lg-hover': 'The size lg select hovered; check that the border darkens at the larger field height.',
    'size-lg-active': 'The size lg select pressed; check the press look on the larger field frame.',
    'size-lg-focus-visible':
      'The size lg select focused by keyboard; check that the focus ring wraps the larger field.',
  },
  grid,
  widths: [320],
  controls: {
    select: { kind: 'select', input: ['pointer', 'keyboard'], disabled: true, surfaces: { open: 'open' } },
  },
  render: (props) => drawing({ body: selectBody(props), styles: [selectStyles, styles].join('\n') }),
});
