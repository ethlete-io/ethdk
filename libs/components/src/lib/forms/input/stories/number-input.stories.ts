import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldNumberInputStorybookComponent } from './number-input-storybook.component';

export default {
  title: 'Components/Forms/Number Input',
  component: FormFieldNumberInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldNumberInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'number' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    stepper: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    showPrefix: { control: 'boolean' },
    showSuffix: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Amount',
    placeholder: '0',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    min: null,
    max: null,
    step: null,
    stepper: false,
    disabled: false,
    required: false,
    showPrefix: false,
    showSuffix: false,
    color: 'brand',
  },
} as Meta<FormFieldNumberInputStorybookComponent>;

type Story = StoryObj<FormFieldNumberInputStorybookComponent>;

export const Default: Story = {};

export const Stepper: Story = {
  args: { stepper: true, min: 0, max: 10, hint: 'Hold a button to auto-repeat' },
};

export const Mixed: Story = {
  args: {
    value: 42,
    mixed: true,
    mixedLabel: 'Mixed amounts',
    showMixedState: true,
    hint: 'The raw value stays hidden and intact until typing commits a replacement; the mixed label shows as the placeholder.',
  },
};
