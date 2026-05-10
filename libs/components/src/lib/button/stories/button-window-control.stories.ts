import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonWindowControlStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Window Control',
  component: ButtonWindowControlStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonWindowControlStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    pressed: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false, pressed: false },
} as Meta<ButtonWindowControlStorybookComponent>;

type Story = StoryObj<ButtonWindowControlStorybookComponent>;

export const Default: Story = {};
