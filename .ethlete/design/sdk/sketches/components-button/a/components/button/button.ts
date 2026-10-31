import { button, buttonStyles, ButtonMockOptions } from '@ethlete/components/design/button';
import { definePart, drawing, forceInteraction, interactionRows } from '@design-system';

type ButtonInteraction = 'hover' | 'active' | 'focus-visible';

type Props = ButtonMockOptions & { interaction?: ButtonInteraction };

const control = ({ interaction, ...options }: Props) => {
  const markup = button(options).replace(/^<(button|a) /, '<$1 data-et-control="button" data-can-animate ');

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export const { states, grid } = interactionRows<
  Props,
  'filled' | 'outline' | 'tonal' | 'transparent' | 'pressed' | 'danger' | 'small' | 'disabled',
  ButtonInteraction
>(
  {
    filled: { label: 'Save', variant: 'filled' },
    outline: { label: 'Cancel', variant: 'outline' },
    tonal: { label: 'Filter', variant: 'tonal' },
    transparent: { label: 'More', variant: 'transparent' },
    pressed: { label: 'Grid', variant: 'outline', pressed: true },
    danger: { label: 'Delete', variant: 'filled', color: 'danger' },
    small: { label: 'Save', variant: 'filled', size: 'sm' },
    disabled: { label: 'Save', variant: 'filled', disabled: true },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The SDK button, drawn by its mock from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5'],
  states,
  grid,
  controls: { button: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true } },
  render: (props: Props) => drawing({ body: control(props), styles: buttonStyles }),
});
