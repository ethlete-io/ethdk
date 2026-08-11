import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldWarningStorybookComponent } from './warning-storybook.component';

export default {
  title: 'Components/Forms/Warning',
  component: FormFieldWarningStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldWarningStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    color: 'brand',
  },
} as Meta<FormFieldWarningStorybookComponent>;

type Story = StoryObj<FormFieldWarningStorybookComponent>;

/**
 * A `warn()` rule puts an advisory where an error would go, in the app's `type: 'warning'` theme,
 * while the field stays valid and submittable. Shorten the password below 8 characters and the
 * validation error takes the slot back until it is fixed.
 */
export const Default: Story = {};
