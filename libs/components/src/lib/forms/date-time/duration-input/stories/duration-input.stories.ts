import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DurationInputStorybookComponent } from './duration-input-storybook.component';

export default {
  title: 'Components/Forms/Duration Input',
  component: DurationInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DurationInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    durationFormat: { control: 'text' },
    value: { control: 'number' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Lap time',
    hint: 'Type 130 for 1:30',
    placeholder: 'mm:ss',
    durationFormat: 'mm:ss',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<DurationInputStorybookComponent>;

type Story = StoryObj<DurationInputStorybookComponent>;

export const Default: Story = {};

export const HoursMinutesSeconds: Story = {
  args: { label: 'Race duration', durationFormat: 'hh:mm:ss', placeholder: 'hh:mm:ss', hint: '' },
};

export const WithMilliseconds: Story = {
  args: { label: 'Split time', durationFormat: 'mm:ss.SSS', placeholder: 'mm:ss.SSS', hint: '' },
};

export const Mixed: Story = {
  args: {
    value: 90000,
    mixed: true,
    mixedLabel: 'Mixed durations',
    showMixedState: true,
    hint: 'The hidden duration stays intact and unshown; the mixed label is the placeholder. Typing a duration commits a replacement.',
  },
};
