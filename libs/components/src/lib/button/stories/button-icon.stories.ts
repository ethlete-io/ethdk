import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonIconStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Icon',
  component: ButtonIconStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonIconStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    pressed: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false, pressed: false },
} as Meta<ButtonIconStorybookComponent>;

type Story = StoryObj<ButtonIconStorybookComponent>;

export const Default: Story = {};
