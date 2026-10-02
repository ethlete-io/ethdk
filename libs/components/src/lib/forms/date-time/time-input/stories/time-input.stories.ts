import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TimeInputStorybookComponent } from './time-input-storybook.component';

export default {
  title: 'Components/Forms/Time Input',
  component: TimeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimeInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
    mask: { control: 'boolean' },
    minuteStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    minTime: { control: 'text' },
    maxTime: { control: 'text' },
    filter: { control: 'select', options: ['none', 'noLunchBreak', 'weekdayHours'] },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Time',
    placeholder: 'hh:mm',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: 'HH:mm',
    displayFormat: 'p',
    mask: false,
    minuteStep: 5,
    locale: 'default',
    minTime: null,
    maxTime: null,
    filter: 'none',
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<TimeInputStorybookComponent>;

type Story = StoryObj<TimeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: '14:30' },
};

export const WithSeconds: Story = {
  args: { valueFormat: 'HH:mm:ss', displayFormat: 'pp', hint: 'Type the seconds; the ring picks hours and minutes' },
};

export const OpeningHours: Story = {
  args: {
    minTime: '09:00',
    maxTime: '17:30',
    filter: 'noLunchBreak',
    hint: 'The picker only offers 09:00–17:30, lunch hour excluded',
  },
};

export const German: Story = {
  args: { locale: 'de', hint: '24-Stunden-Anzeige (p mit de-Locale)' },
};

export const Mixed: Story = {
  args: {
    value: '14:30',
    mixed: true,
    mixedLabel: 'Mixed times',
    showMixedState: true,
    hint: 'The hidden time stays intact and unshown; the mixed label is the placeholder. Parsing a typed time or picking one commits a replacement.',
  },
};

export const Masked: Story = {
  args: {
    displayFormat: 'HH:mm',
    mask: true,
    placeholder: '',
    hint: 'A fixed-width display format drives a typing mask',
  },
};
