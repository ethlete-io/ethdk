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
  },
  args: { color: 'brand', disabled: false, loading: false, pressed: false },
} as Meta<ButtonSurfaceStorybookComponent>;

type Story = StoryObj<ButtonSurfaceStorybookComponent>;

export const Default: Story = {};

export const WithIcon: StoryObj<ButtonSurfaceIconStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ButtonSurfaceIconStorybookComponent] })],
  render: (args) => ({
    props: args,
    template: `
      <et-sb-button-surface-icon
        [color]="color"
        [disabled]="disabled"
        [loading]="loading"
      />
    `,
  }),
};
