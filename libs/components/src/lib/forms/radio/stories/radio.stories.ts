import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldRadioStorybookComponent } from './radio-storybook.component';

export default {
  title: 'Components/Forms/Radio',
  component: FormFieldRadioStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldRadioStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Favorite color',
    hint: '',
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<FormFieldRadioStorybookComponent>;

type Story = StoryObj<FormFieldRadioStorybookComponent>;

export const Default: Story = {};
