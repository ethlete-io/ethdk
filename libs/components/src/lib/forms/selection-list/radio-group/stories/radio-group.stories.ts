import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { RadioGroupStorybookComponent } from './radio-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Radio Group',
  component: RadioGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [RadioGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'select', options: [null, 'red', 'green', 'blue'] },
    mixed: { control: 'boolean' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: {
    label: 'Favorite color',
    hint: '',
    value: null,
    mixed: false,
    showMixedState: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
    size: 'md',
  },
} as Meta<RadioGroupStorybookComponent>;

type Story = StoryObj<RadioGroupStorybookComponent>;

export const Default: Story = {};

export const Mixed: Story = {
  args: {
    value: 'green',
    mixed: true,
    showMixedState: true,
    hint: 'Bulk edit over records that disagree — no radio reads as checked until a user picks one, which replaces the hidden raw value.',
  },
};

export const Readonly: Story = {
  args: { readonly: true },
};
