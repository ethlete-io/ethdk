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
    stretch: { control: 'boolean' },
    showMixedState: { control: false, table: { disable: true } },
    maxWidth: { control: 'text' },
    tokens: { control: 'text' },
    inScrollable: { control: 'boolean' },
    options: { table: { disable: true } },
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
    stretch: false,
    showMixedState: false,
    disabled: false,
    required: false,
    color: 'brand',
    size: 'md',
    maxWidth: null,
    tokens: null,
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

export const LongLabel: Story = {
  args: {
    maxWidth: '390px',
    value: 'all',
    label: 'Competition',
    options: [
      { value: 'all', label: 'All' },
      { value: 'long', label: 'FIFA World Cup 26 qualifiers - second round' },
      { value: 'cup', label: 'Cup' },
    ],
    hint: 'In a narrow container the row stops at the container edge and the long label truncates.',
  },
};

export const Stretch: Story = {
  args: {
    stretch: true,
    value: 'all',
    label: 'Competition',
    options: [
      { value: 'all', label: 'All' },
      { value: 'live', label: 'Live now' },
      { value: 'upcoming', label: 'Upcoming matches' },
      { value: 'done', label: 'Done' },
    ],
    hint: 'Every segment gets the same column width and the group fills its container, whatever the label lengths.',
  },
};

export const LabelLook: Story = {
  args: {
    tokens: '--et-segmented-button-color: white; --et-segmented-button-font-weight: 700;',
    hint: 'Set --et-segmented-button-color and --et-segmented-button-font-weight to restyle the inactive labels.',
  },
};

export const TrackBackground: Story = {
  args: {
    tokens: '--et-segmented-button-group-track-background: #1e3a5f;',
    hint: 'Set --et-segmented-button-group-track-background to replace the tonal track.',
  },
};

export const StretchTrackAuto: Story = {
  args: {
    stretch: true,
    maxWidth: '410px',
    tokens: '--et-segmented-button-group-stretch-track: auto;',
    value: 'all',
    label: 'Competition',
    options: [
      { value: 'all', label: 'All' },
      { value: 'live', label: 'Live now' },
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'done', label: 'Done' },
    ],
    hint: 'With --et-segmented-button-group-stretch-track: auto the columns size to their labels and still fill the row.',
  },
};

export const Columns: Story = {
  args: {
    maxWidth: '390px',
    stretch: true,
    tokens: '--et-segmented-button-group-columns: 2;',
    value: 'all',
    label: 'Competition',
    options: [
      { value: 'all', label: 'All' },
      { value: 'live', label: 'Live now' },
      { value: 'upcoming', label: 'Upcoming' },
      { value: 'done', label: 'Done' },
    ],
    hint: 'With --et-segmented-button-group-columns: 2 the four options wrap into two rows of two.',
  },
};

export const InScrollable: Story = {
  args: {
    inScrollable: true,
    value: 'ea',
    label: 'Game',
    options: [{ value: 'ea', label: 'EA SPORTS FC' }],
  },
};
