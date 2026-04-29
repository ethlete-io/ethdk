import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonIconStorybookComponent } from './components';

const THEME_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Icon',
  component: ButtonIconStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonIconStorybookComponent] })],
  argTypes: {
    theme: { control: 'select', options: THEME_OPTIONS },
    disabled: { control: 'boolean' },
    pressed: { control: 'boolean' },
  },
  args: { theme: 'brand', disabled: false, pressed: false },
} as Meta<ButtonIconStorybookComponent>;

type Story = StoryObj<ButtonIconStorybookComponent>;

export const Default: Story = {};
