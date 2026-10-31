import {
  button,
  buttonStyles,
  ButtonMockOptions,
  iconButton,
  IconButtonMockOptions,
  iconButtonStyles,
} from '@ethlete/components/design/button';
import { iconMarkup } from '@ethlete/components/design/icon';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing, forceInteraction, interactionRows } from '@design-system';
import hover from './button.css?inline';

type ButtonInteraction = 'hover' | 'active' | 'focus-visible';

type IconOnly = IconButtonMockOptions & { iconOnly: true };

type Props = (ButtonMockOptions | IconOnly) & { interaction?: ButtonInteraction };

const control = ({ interaction, ...options }: Props) => {
  const drawn = 'iconOnly' in options ? iconButton(options) : button(options);
  const markup = drawn.replace(/^<(button|a) /, '<$1 data-et-control="button" data-can-animate ');

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const plus = iconMarkup(SDK_ICONS.find((each) => each.name === 'et-plus')!);
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const VARIANTS = ['filled', 'outline', 'tonal', 'transparent'] as const;
type Size = (typeof SIZES)[number];

const interactive = interactionRows<
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

const iconOnly = interactionRows<Props, `icon-${(typeof VARIANTS)[number]}`, ButtonInteraction>(
  Object.fromEntries(
    VARIANTS.map((variant) => [`icon-${variant}`, { iconOnly: true, icon: plus, ariaLabel: 'Add', variant }]),
  ) as Record<`icon-${(typeof VARIANTS)[number]}`, Props>,
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const sizeStates = Object.fromEntries(
  SIZES.map((size) => [`size-${size}`, { label: 'Add', icon: plus, variant: 'filled', size }]),
) as Record<`size-${Size}`, Props>;

export const states = { ...interactive.states, ...iconOnly.states, ...sizeStates };
export const grid = {
  columns: interactive.grid.columns,
  rows: {
    ...interactive.grid.rows,
    ...Object.fromEntries(VARIANTS.map((variant) => [`icon ${variant}`, iconOnly.grid.rows[`icon-${variant}`]])),
    ...Object.fromEntries(SIZES.map((size) => [`size ${size}`, { rest: `size-${size}` as const }])),
  },
};

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states,
  grid,
  controls: { button: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true } },
  render: (props: Props) =>
    drawing({
      body: control(props),
      styles: ['iconOnly' in props ? iconButtonStyles : buttonStyles, hover].join('\n'),
    }),
});
