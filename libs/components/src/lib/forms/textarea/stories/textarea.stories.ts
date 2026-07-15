import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldTextareaStorybookComponent } from './textarea-storybook.component';

export default {
  title: 'Components/Forms/Textarea',
  component: FormFieldTextareaStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldTextareaStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    rows: { control: 'number' },
    autosize: { control: 'boolean' },
    minRows: { control: 'number' },
    maxRows: { control: 'number' },
    resize: { control: 'select', options: ['none', 'vertical'] },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Message',
    placeholder: 'Write something…',
    hint: '',
    value: '',
    rows: 3,
    autosize: true,
    minRows: null,
    maxRows: null,
    resize: 'vertical',
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<FormFieldTextareaStorybookComponent>;

type Story = StoryObj<FormFieldTextareaStorybookComponent>;

export const Default: Story = {};

export const FixedWithMaxRows: Story = {
  args: {
    autosize: true,
    maxRows: 6,
  },
};

export const ManualResize: Story = {
  args: {
    autosize: false,
    rows: 4,
  },
};
