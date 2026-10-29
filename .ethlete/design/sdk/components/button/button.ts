import { button, buttonStyles, ButtonMockOptions } from '@ethlete/components/design/button';
import { definePart, drawing } from '@design-system';

type Props = ButtonMockOptions;

export default definePart<Props>({
  note: 'The SDK button, drawn by its mock from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5'],
  states: {
    filled: { label: 'Save', variant: 'filled' },
    outline: { label: 'Cancel', variant: 'outline' },
    tonal: { label: 'Filter', variant: 'tonal' },
    transparent: { label: 'More', variant: 'transparent' },
    pressed: { label: 'Grid', variant: 'outline', pressed: true },
    danger: { label: 'Delete', variant: 'filled', color: 'danger' },
    small: { label: 'Save', variant: 'filled', size: 'sm' },
  },
  interactions: ['hover', 'focus-visible', 'active', 'disabled'],
  render: (props) => drawing({ body: button(props), styles: buttonStyles }),
});
