import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CheckboxGroupStorybookComponent, FormFieldCheckboxStorybookComponent } from './checkbox-storybook.component';

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

export const Group: StoryObj<CheckboxGroupStorybookComponent> = {
  render: (args) => ({
    moduleMetadata: { imports: [CheckboxGroupStorybookComponent] },
    template: '<et-sb-checkbox-group [color]="color" [disabled]="disabled" />',
    props: args,
  }),
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    disabled: { control: 'boolean' },
  },
  args: {
    color: 'brand',
    disabled: false,
  },
};
