import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CheckboxGroupStorybookComponent } from './checkbox-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Checkbox Group',
  component: CheckboxGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [CheckboxGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Select toppings',
    hint: '',
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<CheckboxGroupStorybookComponent>;

type Story = StoryObj<CheckboxGroupStorybookComponent>;

export const Default: Story = {};
