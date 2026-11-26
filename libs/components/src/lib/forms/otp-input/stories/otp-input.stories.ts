import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { OtpInputStorybookComponent } from './otp-input-storybook.component';

export default {
  title: 'Components/Forms/Otp Input',
  component: OtpInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [OtpInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    length: { control: 'number' },
    charset: { control: 'select', options: ['numeric', 'alphanumeric'] },
    masked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Verification code',
    hint: '',
    length: 6,
    charset: 'numeric',
    masked: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<OtpInputStorybookComponent>;

type Story = StoryObj<OtpInputStorybookComponent>;

export const Default: Story = {};

export const MaskedPin: Story = {
  args: { length: 4, masked: true, label: 'PIN' },
};
