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
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
  },
  args: {
    color: 'brand',
    hint: '',
    disabled: false,
    readonly: false,
    required: false,
    indeterminate: false,
  },
} as Meta<FormFieldCheckboxStorybookComponent>;

type Story = StoryObj<FormFieldCheckboxStorybookComponent>;

export const Default: Story = {};

export const Readonly: Story = {
  args: { readonly: true, hint: 'View-only: normal look, focusable, cannot be toggled' },
};

export const Indeterminate: Story = {
  args: { indeterminate: true, hint: 'Tri-state: toggling an indeterminate checkbox resolves it to checked' },
};
