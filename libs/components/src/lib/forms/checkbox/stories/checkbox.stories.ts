import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CheckboxGroupStorybookComponent, FormFieldCheckboxStorybookComponent } from './checkbox-storybook.component';

export default {
  title: 'Components/Forms/Checkbox',
  component: FormFieldCheckboxStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldCheckboxStorybookComponent] })],
} as Meta<FormFieldCheckboxStorybookComponent>;

type Story = StoryObj<FormFieldCheckboxStorybookComponent>;

export const Default: Story = {};

export const Group: StoryObj<CheckboxGroupStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [CheckboxGroupStorybookComponent] },
    template: '<et-sb-checkbox-group />',
  }),
};
