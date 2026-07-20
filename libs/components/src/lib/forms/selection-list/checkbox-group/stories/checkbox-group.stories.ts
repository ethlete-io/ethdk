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
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    groupControl: { control: 'boolean' },
  },
  args: {
    label: 'Select toppings',
    hint: '',
    disabled: false,
    required: false,
    color: 'brand',
    size: 'md',
    groupControl: false,
  },
} as Meta<CheckboxGroupStorybookComponent>;

type Story = StoryObj<CheckboxGroupStorybookComponent>;

export const Default: Story = {};

export const GroupControl: Story = {
  args: {
    groupControl: true,
    hint: 'The headless [etSelectionListControl] renders a tri-state select-all: unchecked, mixed, checked',
  },
};
