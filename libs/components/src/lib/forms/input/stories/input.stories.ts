import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldInputStorybookComponent } from './input-storybook.component';

export default {
  title: 'Components/Forms/Input',
  component: FormFieldInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'tel', 'number'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
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
    type: 'text',
    label: 'Label',
    placeholder: 'Placeholder',
    hint: '',
    value: '',
    disabled: false,
    required: false,
    showPrefix: false,
    showSuffix: false,
    color: 'brand',
  },
} as Meta<FormFieldInputStorybookComponent>;

type Story = StoryObj<FormFieldInputStorybookComponent>;

export const Default: Story = {};
