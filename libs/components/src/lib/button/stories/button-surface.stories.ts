import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonSurfaceIconStorybookComponent, ButtonSurfaceStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral', 'neutral-dark', 'surface'] as const;

const PRESSED_COLOR_OPTIONS = [...COLOR_OPTIONS, 'inherit'] as const;

export default {
  title: 'Components/Actions/Button/Surface',
  component: ButtonSurfaceStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonSurfaceStorybookComponent] })],
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
} as Meta<ButtonSurfaceStorybookComponent>;

type Story = StoryObj<ButtonSurfaceStorybookComponent>;

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

/**
 * `loading` alone overlays an indeterminate spinner - the right thing for work of unknown length.
 */
export const Loading: Story = {
  args: { loading: true },
};

/**
 * `progress` (`0`-`100`) turns that spinner into a determinate arc with a track, so a long action
 * shows how far along it is. Clear the control to go back to the indeterminate ring.
 */
export const LoadingWithProgress: Story = {
  args: { loading: true, progress: 65 },
};

export const WithIcon: StoryObj<ButtonSurfaceIconStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ButtonSurfaceIconStorybookComponent] })],
  render: (args) => ({
    props: args,
    template: `
      <et-sb-button-surface-icon
        [color]="color"
        [disabled]="disabled"
        [loading]="loading"
        [progress]="progress"
        [pressedColor]="pressedColor"
      />
    `,
  }),
};
