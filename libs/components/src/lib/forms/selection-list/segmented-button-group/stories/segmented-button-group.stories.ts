import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SegmentedButtonGroupStorybookComponent } from './segmented-button-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Segmented Button Group',
  component: SegmentedButtonGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [SegmentedButtonGroupStorybookComponent] })],
  argTypes: {
    variant: { control: 'radio', options: ['pill', 'tabs'] },
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
    variant: 'pill',
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
    hint: 'Bulk edit over records that disagree - no segment reads as selected until a user picks one, which replaces the hidden raw value.',
  },
};

export const Tabs: Story = {
  args: { variant: 'tabs', label: 'View' },
  parameters: {
    docs: {
      description: {
        story:
          'The tabs variant underlines the selection instead of filling it, for a group that reads as a set of ' +
          'views. The same element the FLIP animation moves becomes the underline, so the selection still slides. ' +
          'It is still a selection *control* - if the segments are routes or linkable panels, use ' +
          '[tabs](/components/tabs).',
      },
    },
  },
};
