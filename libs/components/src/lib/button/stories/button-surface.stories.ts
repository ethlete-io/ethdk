import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonSurfaceIconStorybookComponent, ButtonSurfaceStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral', 'neutral-dark'] as const;

export default {
  title: 'Components/Button/Surface',
  component: ButtonSurfaceStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonSurfaceStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    pressed: { control: 'boolean' },
    tone: { control: 'select', options: ['theme', 'surface'] },
    mutedUntilPressed: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false, pressed: false, tone: 'theme', mutedUntilPressed: false },
} as Meta<ButtonSurfaceStorybookComponent>;

type Story = StoryObj<ButtonSurfaceStorybookComponent>;

export const Default: Story = {};

/**
 * `tone="surface"` takes the button's color from the surface it sits on instead of the ambient color
 * theme, so a secondary or cancel action reads as chrome without a neutral color theme registered.
 * Every variant keeps its structural signature; switch the `color` control and nothing moves.
 */
export const SurfaceTone: Story = {
  args: { tone: 'surface' },
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
        [mutedUntilPressed]="mutedUntilPressed"
      />
    `,
  }),
};
