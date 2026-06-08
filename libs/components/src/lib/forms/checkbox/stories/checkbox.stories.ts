import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldCheckboxStorybookComponent } from './checkbox-storybook.component';

export default {
  title: 'Components/Forms/Checkbox',
  component: FormFieldCheckboxStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldCheckboxStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
  },
  args: {
    color: 'brand',
    hint: '',
    disabled: false,
    required: false,
  },
} as Meta<FormFieldCheckboxStorybookComponent>;

type Story = StoryObj<FormFieldCheckboxStorybookComponent>;

export const Default: Story = {};
