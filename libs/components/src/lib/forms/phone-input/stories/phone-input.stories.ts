import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { PhoneInputStorybookComponent } from './phone-input-storybook.component';

export default {
  title: 'Components/Forms/Phone Input',
  component: PhoneInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [PhoneInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    defaultCountry: { control: 'text' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Phone number',
    placeholder: '170 1234567',
    hint: '',
    value: '',
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    defaultCountry: 'de',
    disabled: false,
    readonly: false,
    color: 'brand',
  },
} as Meta<PhoneInputStorybookComponent>;

type Story = StoryObj<PhoneInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: '+33123456789' },
};

export const Mixed: Story = {
  args: {
    value: '+491701234567',
    mixed: true,
    mixedLabel: 'Mixed',
    showMixedState: true,
    hint: 'The hidden number stays intact; the first typed number is built from scratch with the chosen country.',
  },
};
