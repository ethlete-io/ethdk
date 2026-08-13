import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonIconStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral', 'surface'] as const;

const PRESSED_COLOR_OPTIONS = [...COLOR_OPTIONS, 'inherit'] as const;

export default {
  title: 'Components/Actions/Button/Icon',
  component: ButtonIconStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonIconStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    progress: { control: { type: 'number', min: 0, max: 100, step: 1 } },
    pressed: { control: 'boolean' },
    pressedColor: { control: 'select', options: PRESSED_COLOR_OPTIONS },
  },
  args: {
    color: 'brand',
    disabled: false,
    loading: false,
    progress: undefined,
    pressed: false,
    pressedColor: undefined,
  },
} as Meta<ButtonIconStorybookComponent>;

type Story = StoryObj<ButtonIconStorybookComponent>;

export const Default: Story = {};

/**
 * `color="surface"` resolves the button's colors from the surface it sits on instead of an accent
 * theme, so a secondary or cancel action reads as chrome without a neutral color theme registered.
 * It is a color theme like any other - every variant keeps its own structural signature.
 */
export const SurfaceColor: Story = {
  args: { color: 'surface' },
};

/**
 * `pressedColor` swaps the theme only while the button is pressed. Paired with `color="surface"` it
 * is the toolbar toggle pattern: neutral at rest, picking up the surrounding theme once active.
 */
export const NeutralUntilPressed: Story = {
  args: { color: 'surface', pressedColor: 'inherit', pressed: true },
};
