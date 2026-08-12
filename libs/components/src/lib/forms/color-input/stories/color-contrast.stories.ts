import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldColorContrastStorybookComponent } from './color-contrast-storybook.component';

export default {
  title: 'Components/Forms/Color Input/Contrast',
  component: FormFieldColorContrastStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldColorContrastStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    color: 'brand',
  },
} as Meta<FormFieldColorContrastStorybookComponent>;

type Story = StoryObj<FormFieldColorContrastStorybookComponent>;

export const Default: Story = {};
