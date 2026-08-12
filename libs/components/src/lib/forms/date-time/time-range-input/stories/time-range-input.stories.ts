import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TimeRangeInputStorybookComponent } from './time-range-input-storybook.component';

export default {
  title: 'Components/Forms/Time Range Input',
  component: TimeRangeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimeRangeInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    startPlaceholder: { control: 'text' },
    endPlaceholder: { control: 'text' },
    hint: { control: 'text' },
    start: { control: 'text' },
    end: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
    mask: { control: 'boolean' },
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    minTime: { control: 'text' },
    maxTime: { control: 'text' },
    filter: { control: 'select', options: ['none', 'noLunchBreak', 'weekdayHours', 'endAfterStart'] },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    maxInlineSize: { control: 'number' },
  },
  args: {
    label: 'Time range',
    startPlaceholder: 'Start',
    endPlaceholder: 'End',
    hint: '',
    start: null,
    end: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: undefined,
    displayFormat: 'p',
    mask: false,
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    minTime: null,
    maxTime: null,
    filter: 'none',
    disabled: false,
    readonly: false,
    color: 'brand',
    maxInlineSize: 480,
  },
} as Meta<TimeRangeInputStorybookComponent>;

type Story = StoryObj<TimeRangeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: {
    start: '09:00',
    end: '17:30',
    hint: 'One set of columns holds both ends - the side switch says which one a pick fills',
  },
};

export const Narrow: Story = {
  args: {
    start: '09:00',
    end: '17:30',
    maxInlineSize: 240,
    hint: 'Too narrow for both times on one line, so they stack - start above end, and the separator goes with the line',
  },
};

export const TwelveHour: Story = {
  args: {
    start: '09:00',
    end: '17:30',
    displayFormat: 'h:mm a',
    hint: 'A 12-hour display format adds the AM/PM column to the picker',
  },
};

export const Masked: Story = {
  args: {
    displayFormat: 'HH:mm',
    mask: true,
    startPlaceholder: '',
    endPlaceholder: '',
    hint: 'A fixed-width display format drives a typing mask on both sides',
  },
};

export const Bounded: Story = {
  args: {
    minTime: '08:00',
    maxTime: '18:00',
    hint: 'Both ends stay inside opening hours; typed entry outside them is a validator concern',
  },
};

export const EndAfterStart: Story = {
  args: {
    start: '09:00',
    filter: 'endAfterStart',
    hint: 'The time filter knows which end it is filling, so the end rejects everything up to the committed start',
  },
};

export const German: Story = {
  args: { locale: 'de', start: '09:00', end: '17:30', hint: '24-Stunden-Anzeige (p mit de-Locale)' },
};

export const Mixed: Story = {
  args: {
    start: '09:00',
    end: '17:30',
    mixed: true,
    mixedLabel: 'Mixed values',
    showMixedState: true,
    hint: 'The hidden range stays intact and unshown; the mixed label is both placeholders. The first resolving commit replaces the whole range.',
  },
};
