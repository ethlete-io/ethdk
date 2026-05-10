import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonFabStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/FAB',
  component: ButtonFabStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonFabStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false },
} as Meta<ButtonFabStorybookComponent>;

type Story = StoryObj<ButtonFabStorybookComponent>;

export const Default: Story = {};
