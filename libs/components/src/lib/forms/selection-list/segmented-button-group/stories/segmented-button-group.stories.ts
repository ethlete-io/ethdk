import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SegmentedButtonGroupStorybookComponent } from './segmented-button-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Segmented Button Group',
  component: SegmentedButtonGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [SegmentedButtonGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'select', options: [null, 'list', 'grid', 'table'] },
    mixed: { control: 'boolean' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: {
    label: 'View mode',
    hint: '',
    value: 'list',
    mixed: false,
    showMixedState: false,
    disabled: false,
    required: false,
    color: 'brand',
    size: 'md',
  },
} as Meta<SegmentedButtonGroupStorybookComponent>;

type Story = StoryObj<SegmentedButtonGroupStorybookComponent>;

export const Default: Story = {};

export const Mixed: Story = {
  args: {
    value: 'grid',
    mixed: true,
    showMixedState: true,
    hint: 'Bulk edit over records that disagree — no segment reads as selected until a user picks one, which replaces the hidden raw value.',
  },
};
