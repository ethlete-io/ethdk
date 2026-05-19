import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldCheckboxStorybookComponent } from './components';

export default {
  title: 'Components/Forms/Checkbox',
  component: FormFieldCheckboxStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldCheckboxStorybookComponent] })],
} as Meta<FormFieldCheckboxStorybookComponent>;

type Story = StoryObj<FormFieldCheckboxStorybookComponent>;

export const Default: Story = {};
