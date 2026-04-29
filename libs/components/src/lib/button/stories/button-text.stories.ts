import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ButtonTextIconStorybookComponent, ButtonTextStorybookComponent } from './components';

const THEME_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Button/Text',
  component: ButtonTextStorybookComponent,
  decorators: [moduleMetadata({ imports: [ButtonTextStorybookComponent] })],
  argTypes: {
    theme: { control: 'select', options: THEME_OPTIONS },
    disabled: { control: 'boolean' },
  },
  args: { theme: 'brand', disabled: false },
} as Meta<ButtonTextStorybookComponent>;

type Story = StoryObj<ButtonTextStorybookComponent>;

export const Default: Story = {};

export const WithIcon: StoryObj<ButtonTextIconStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ButtonTextIconStorybookComponent] })],
  render: () => ({ template: `<et-sb-button-text-icon />` }),
};
