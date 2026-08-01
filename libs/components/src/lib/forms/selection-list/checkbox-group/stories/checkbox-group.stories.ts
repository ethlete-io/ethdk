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
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
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
    orientation: 'vertical',
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
    hint: 'Bulk edit over records that disagree - no box reads as checked; the first pick replaces the hidden raw array with a fresh one.',
  },
};

export const GroupControl: Story = {
  args: {
    groupControl: true,
    hint: 'One control over all of them: unchecked, mixed, checked',
  },
  parameters: {
    docs: {
      description: {
        story:
          '`<et-checkbox-group-select-all>` is the prebuilt select-all row - the tri-state logic of the ' +
          'headless `etSelectionListControl` plus the markup and the mixed mark. It is a real ' +
          '`role="checkbox"` with `aria-checked="mixed"`, not an option: a listbox option has no mixed ' +
          'state, and "some of these are on" is exactly what this control has to be able to say.',
      },
    },
  },
};

export const Horizontal: Story = {
  args: { orientation: 'horizontal', label: 'Sizes' },
  parameters: {
    docs: {
      description: {
        story:
          '`orientation="horizontal"` flows the options in a wrapping row. The group’s label and its ' +
          'error/hint block keep their own lines above and below - only the options move, and an option is ' +
          'still a direct child of the group, so nothing about the projected DOM changes. Vertical stays the ' +
          'default: it scans better and gives each option a full-width hit area. All four arrow keys move ' +
          'between options either way.',
      },
    },
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
