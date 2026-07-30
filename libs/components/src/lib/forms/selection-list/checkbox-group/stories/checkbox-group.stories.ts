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
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    groupControl: { control: 'boolean' },
    variant: { control: 'radio', options: ['plain', 'card'] },
  },
  args: {
    label: 'Select toppings',
    hint: '',
    value: [],
    mixed: false,
    showMixedState: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
    size: 'md',
    groupControl: false,
    variant: 'plain',
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

export const Readonly: Story = {
  args: { readonly: true },
};

export const Card: Story = {
  args: { variant: 'card', label: 'Pick your toppings', value: ['pepperoni'] },
  parameters: {
    docs: {
      description: {
        story:
          'The card preset: the whole panel is the target, label leading and control trailing, with room for an ' +
          '`<et-description>` under each label. Identical to the radio group card, so a multi- and a ' +
          'single-select list of cards read the same.',
      },
    },
  },
};
