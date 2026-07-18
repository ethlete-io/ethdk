import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PasswordInputStorybookComponent } from './password-input-storybook.component';

export default {
  title: 'Components/Forms/Password Input',
  component: PasswordInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [PasswordInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    value: { control: 'text' },
    revealable: { control: 'boolean' },
    capsLockWarning: { control: 'boolean' },
    showStrength: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Password',
    hint: '',
    placeholder: '',
    value: '',
    revealable: true,
    capsLockWarning: false,
    showStrength: false,
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<PasswordInputStorybookComponent>;

type Story = StoryObj<PasswordInputStorybookComponent>;

export const Default: Story = {};

export const StrengthMeter: Story = {
  args: { showStrength: true, hint: 'Longer + more character classes = higher score' },
};

export const CapsLockWarning: Story = {
  args: { capsLockWarning: true, hint: 'Type with Caps Lock on to see the warning' },
};
