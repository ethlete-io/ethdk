import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldColorInputStorybookComponent } from './color-input-storybook.component';

export default {
  title: 'Components/Forms/Color Input',
  component: FormFieldColorInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldColorInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'color' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Color',
    hint: '',
    value: null,
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<FormFieldColorInputStorybookComponent>;

type Story = StoryObj<FormFieldColorInputStorybookComponent>;

export const Default: Story = {};
