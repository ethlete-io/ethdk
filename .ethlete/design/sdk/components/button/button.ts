import {
  button,
  buttonStyles,
  ButtonMockOptions,
  iconButton,
  IconButtonMockOptions,
  iconButtonStyles,
} from '@ethlete/components/design/button';
import { iconMarkup } from '@ethlete/components/design/icon';
import { loaderStyles } from '@ethlete/components/design/loader';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing, forceInteraction, interactionRows } from '@design-system';
import hover from './button.css?inline';

type ButtonInteraction = 'hover' | 'active' | 'focus-visible';

type IconOnly = IconButtonMockOptions & { iconOnly: true };

type Props = (ButtonMockOptions | IconOnly) & { interaction?: ButtonInteraction };

const control = ({ interaction, ...options }: Props) => {
  const drawn = 'iconOnly' in options ? iconButton(options) : button(options);
  const markup = drawn
    .replace(/^<(button|a) /, '<$1 data-et-control="button" data-can-animate ')
    .replace('<div class="et-button-loader"', '<div class="et-button-loader" data-et-skip="CLIPPED"');

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const fail = (message: string): never => {
  throw new Error(message);
};

const plus = iconMarkup(SDK_ICONS.find((each) => each.name === 'et-plus') ?? fail('SDK_ICONS has no et-plus'));
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
const VARIANTS = ['filled', 'outline', 'tonal', 'transparent'] as const;
type Size = (typeof SIZES)[number];

const interactive = interactionRows<
  Props,
  'filled' | 'outline' | 'tonal' | 'transparent' | 'pressed' | 'danger' | 'small',
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
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const iconOnly = interactionRows<Props, `icon-${(typeof VARIANTS)[number]}`, ButtonInteraction>(
  Object.fromEntries(
    VARIANTS.map((variant) => [`icon-${variant}`, { iconOnly: true, icon: plus, ariaLabel: 'Add', variant }]),
  ) as Record<`icon-${(typeof VARIANTS)[number]}`, Props>,
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const sized = interactionRows<Props, `size-${Size}`, ButtonInteraction>(
  Object.fromEntries(
    SIZES.map((size) => [`size-${size}`, { label: 'Add', icon: plus, variant: 'filled', size }]),
  ) as Record<`size-${Size}`, Props>,
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const disabled: Props = { label: 'Save', variant: 'filled', disabled: true };

export const states = { ...interactive.states, disabled, ...iconOnly.states, ...sized.states };
export const grid = {
  columns: interactive.grid.columns,
  rows: {
    ...interactive.grid.rows,
    disabled: { rest: 'disabled' as const },
    ...Object.fromEntries(VARIANTS.map((variant) => [`icon ${variant}`, iconOnly.grid.rows[`icon-${variant}`]])),
    ...Object.fromEntries(SIZES.map((size) => [`size ${size}`, sized.grid.rows[`size-${size}`]])),
  },
};

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  states,
  grid,
  describe: {
    filled: 'The filled Save button; check the accent fill and the on-colour label.',
    'filled-hover':
      'The filled Save button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'filled-active': 'The filled Save button, pressed; check that it goes a step past hover.',
    'filled-focus-visible': 'The filled Save button, with keyboard focus; check the focus ring outside its edge.',
    outline: 'The outlined Cancel button; check that the border shows against the page with no fill.',
    'outline-hover':
      'The outlined Cancel button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'outline-active': 'The outlined Cancel button, pressed; check that it goes a step past hover.',
    'outline-focus-visible': 'The outlined Cancel button, with keyboard focus; check the focus ring outside its edge.',
    tonal: 'The tonal Filter button; check the light accent tint and the accent label.',
    'tonal-hover':
      'The tonal Filter button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'tonal-active': 'The tonal Filter button, pressed; check that it goes a step past hover.',
    'tonal-focus-visible': 'The tonal Filter button, with keyboard focus; check the focus ring outside its edge.',
    transparent: 'The transparent More button; check that only the label shows, without fill or border.',
    'transparent-hover':
      'The transparent More button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'transparent-active': 'The transparent More button, pressed; check that it goes a step past hover.',
    'transparent-focus-visible':
      'The transparent More button, with keyboard focus; check the focus ring outside its edge.',
    pressed: 'The pressed outline Grid toggle; check that the pressed look differs from the plain outline button.',
    'pressed-hover':
      'The pressed outline Grid toggle, hovered; check that its look changes from rest and the label keeps its contrast.',
    'pressed-active': 'The pressed outline Grid toggle, pressed; check that it goes a step past hover.',
    'pressed-focus-visible':
      'The pressed outline Grid toggle, with keyboard focus; check the focus ring outside its edge.',
    danger: 'The filled Delete button in the danger colour; check the danger fill and that the label reads on it.',
    'danger-hover':
      'The filled Delete button in the danger colour, hovered; check that its look changes from rest and the label keeps its contrast.',
    'danger-active': 'The filled Delete button in the danger colour, pressed; check that it goes a step past hover.',
    'danger-focus-visible':
      'The filled Delete button in the danger colour, with keyboard focus; check the focus ring outside its edge.',
    small: 'The small filled Save button; check the smaller height, padding and text.',
    'small-hover':
      'The small filled Save button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'small-active': 'The small filled Save button, pressed; check that it goes a step past hover.',
    'small-focus-visible': 'The small filled Save button, with keyboard focus; check the focus ring outside its edge.',
    disabled: 'The disabled filled Save button; check that the fill fades and the label stays readable.',
    'icon-filled': 'The filled icon-only Add button; check that the plus sits centred in a square button.',
    'icon-filled-hover':
      'The filled icon-only Add button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'icon-filled-active': 'The filled icon-only Add button, pressed; check that it goes a step past hover.',
    'icon-filled-focus-visible':
      'The filled icon-only Add button, with keyboard focus; check the focus ring outside its edge.',
    'icon-outline': 'The outline icon-only Add button; check that the plus sits centred in a square button.',
    'icon-outline-hover':
      'The outline icon-only Add button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'icon-outline-active': 'The outline icon-only Add button, pressed; check that it goes a step past hover.',
    'icon-outline-focus-visible':
      'The outline icon-only Add button, with keyboard focus; check the focus ring outside its edge.',
    'icon-tonal': 'The tonal icon-only Add button; check that the plus sits centred in a square button.',
    'icon-tonal-hover':
      'The tonal icon-only Add button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'icon-tonal-active': 'The tonal icon-only Add button, pressed; check that it goes a step past hover.',
    'icon-tonal-focus-visible':
      'The tonal icon-only Add button, with keyboard focus; check the focus ring outside its edge.',
    'icon-transparent': 'The transparent icon-only Add button; check that the plus sits centred in a square button.',
    'icon-transparent-hover':
      'The transparent icon-only Add button, hovered; check that its look changes from rest and the label keeps its contrast.',
    'icon-transparent-active': 'The transparent icon-only Add button, pressed; check that it goes a step past hover.',
    'icon-transparent-focus-visible':
      'The transparent icon-only Add button, with keyboard focus; check the focus ring outside its edge.',
    'size-xs':
      'The filled Add button with a plus at size xs; check its height, padding, icon and text against the next step.',
    'size-xs-hover':
      'The filled Add button with a plus at size xs, hovered; check that its look changes from rest and the label keeps its contrast.',
    'size-xs-active': 'The filled Add button with a plus at size xs, pressed; check that it goes a step past hover.',
    'size-xs-focus-visible':
      'The filled Add button with a plus at size xs, with keyboard focus; check the focus ring outside its edge.',
    'size-sm':
      'The filled Add button with a plus at size sm; check its height, padding, icon and text against the next step.',
    'size-sm-hover':
      'The filled Add button with a plus at size sm, hovered; check that its look changes from rest and the label keeps its contrast.',
    'size-sm-active': 'The filled Add button with a plus at size sm, pressed; check that it goes a step past hover.',
    'size-sm-focus-visible':
      'The filled Add button with a plus at size sm, with keyboard focus; check the focus ring outside its edge.',
    'size-md':
      'The filled Add button with a plus at size md; check its height, padding, icon and text against the next step.',
    'size-md-hover':
      'The filled Add button with a plus at size md, hovered; check that its look changes from rest and the label keeps its contrast.',
    'size-md-active': 'The filled Add button with a plus at size md, pressed; check that it goes a step past hover.',
    'size-md-focus-visible':
      'The filled Add button with a plus at size md, with keyboard focus; check the focus ring outside its edge.',
    'size-lg':
      'The filled Add button with a plus at size lg; check its height, padding, icon and text against the next step.',
    'size-lg-hover':
      'The filled Add button with a plus at size lg, hovered; check that its look changes from rest and the label keeps its contrast.',
    'size-lg-active': 'The filled Add button with a plus at size lg, pressed; check that it goes a step past hover.',
    'size-lg-focus-visible':
      'The filled Add button with a plus at size lg, with keyboard focus; check the focus ring outside its edge.',
    'size-xl':
      'The filled Add button with a plus at size xl; check its height, padding, icon and text against the next step.',
    'size-xl-hover':
      'The filled Add button with a plus at size xl, hovered; check that its look changes from rest and the label keeps its contrast.',
    'size-xl-active': 'The filled Add button with a plus at size xl, pressed; check that it goes a step past hover.',
    'size-xl-focus-visible':
      'The filled Add button with a plus at size xl, with keyboard focus; check the focus ring outside its edge.',
  },
  controls: { button: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true } },
  render: (props: Props) =>
    drawing({
      body: control(props),
      styles: [
        'iconOnly' in props ? iconButtonStyles : buttonStyles,
        hover,
        !('iconOnly' in props) && props.loading && loaderStyles,
      ]
        .filter(Boolean)
        .join('\n'),
    }),
});
