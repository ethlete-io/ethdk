import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CheckboxGroupStorybookComponent } from './checkbox-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Checkbox Group',
  component: CheckboxGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [CheckboxGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'object' },
    mixed: { control: 'boolean' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    groupControl: { control: 'boolean' },
  },
  args: {
    label: 'Select toppings',
    hint: '',
    value: [],
    mixed: false,
    showMixedState: false,
    disabled: false,
    required: false,
    color: 'brand',
    size: 'md',
    groupControl: false,
  },
} as Meta<CheckboxGroupStorybookComponent>;

type Story = StoryObj<CheckboxGroupStorybookComponent>;

export const Default: Story = {};

export const Mixed: Story = {
  args: {
    value: ['cheese', 'mushrooms'],
    mixed: true,
    showMixedState: true,
    hint: 'Bulk edit over records that disagree — no box reads as checked; the first pick replaces the hidden raw array with a fresh one.',
  },
};

export const GroupControl: Story = {
  args: {
    groupControl: true,
    hint: 'The headless [etSelectionListControl] renders a tri-state select-all: unchecked, mixed, checked',
  },
};
