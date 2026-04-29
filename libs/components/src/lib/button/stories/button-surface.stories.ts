import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonSurfaceIconStorybookComponent, ButtonSurfaceStorybookComponent } from './components';

const THEME_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Surface',
  component: ButtonSurfaceStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonSurfaceStorybookComponent] })],
  argTypes: {
    theme: { control: 'select', options: THEME_OPTIONS },
    disabled: { control: 'boolean' },
    pressed: { control: 'boolean' },
  },
  args: { theme: 'brand', disabled: false, pressed: false },
} as Meta<ButtonSurfaceStorybookComponent>;

type Story = StoryObj<ButtonSurfaceStorybookComponent>;

export const Default: Story = {};

export const WithIcon: StoryObj<ButtonSurfaceIconStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ButtonSurfaceIconStorybookComponent] })],
  render: () => ({ template: `<et-sb-button-surface-icon />` }),
};
