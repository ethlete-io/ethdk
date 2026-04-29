import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonFabStorybookComponent } from './components';

const THEME_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/FAB',
  component: ButtonFabStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonFabStorybookComponent] })],
  argTypes: {
    theme: { control: 'select', options: THEME_OPTIONS },
    disabled: { control: 'boolean' },
    pressed: { control: 'boolean' },
  },
  args: { theme: 'brand', disabled: false, pressed: false },
} as Meta<ButtonFabStorybookComponent>;

type Story = StoryObj<ButtonFabStorybookComponent>;

export const Default: Story = {};
