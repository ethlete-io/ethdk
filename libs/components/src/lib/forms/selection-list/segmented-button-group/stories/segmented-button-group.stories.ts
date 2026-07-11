import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SegmentedButtonGroupStorybookComponent } from './segmented-button-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Segmented Button Group',
  component: SegmentedButtonGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [SegmentedButtonGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  args: {
    label: 'View mode',
    hint: '',
    disabled: false,
    required: false,
    color: 'brand',
    size: 'md',
  },
} as Meta<SegmentedButtonGroupStorybookComponent>;

type Story = StoryObj<SegmentedButtonGroupStorybookComponent>;

export const Default: Story = {};
