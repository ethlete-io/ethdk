import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonWindowControlStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Actions/Button/Window Control',
  component: ButtonWindowControlStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonWindowControlStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    progress: { control: { type: 'number', min: 0, max: 100, step: 1 } },
    pressed: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false, progress: undefined, pressed: false },
} as Meta<ButtonWindowControlStorybookComponent>;

type Story = StoryObj<ButtonWindowControlStorybookComponent>;

export const Default: Story = {};
