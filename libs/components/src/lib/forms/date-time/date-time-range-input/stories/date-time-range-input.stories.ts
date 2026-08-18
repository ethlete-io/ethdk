import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateTimeRangeInputStorybookComponent } from './date-time-range-input-storybook.component';

export default {
  title: 'Components/Forms/Date Time Range Input',
  component: DateTimeRangeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DateTimeRangeInputStorybookComponent] })],
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
    label: 'Date & time range',
    startPlaceholder: 'Start',
    endPlaceholder: 'End',
    hint: '',
    start: null,
    end: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: undefined,
    displayFormat: 'Pp',
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
} as Meta<DateTimeRangeInputStorybookComponent>;

type Story = StoryObj<DateTimeRangeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: {
    start: '2026-07-16T09:00:00+02:00',
    end: '2026-07-16T17:30:00+02:00',
    hint: 'A same-day range: pick the day once, then a time per side',
  },
};

export const Narrow: Story = {
  args: {
    start: '2026-07-16T09:00:00+02:00',
    end: '2026-07-16T17:30:00+02:00',
    maxInlineSize: 260,
    hint: 'Too narrow for both timestamps on one line, so they stack - start above end, and the separator goes with the line',
  },
};

export const Masked: Story = {
  args: {
    displayFormat: 'dd.MM.yyyy HH:mm',
    mask: true,
    startPlaceholder: '',
    endPlaceholder: '',
    hint: 'A fixed-width display format drives a typing mask on both sides',
  },
};

export const EndAfterStart: Story = {
  args: {
    start: '2026-07-16T09:00:00+02:00',
    filter: 'endAfterStart',
    hint: 'The time filter knows which side it is filling, so the end pane can reject everything up to the committed start',
  },
};

export const OpeningHours: Story = {
  args: {
    start: '2026-07-16T10:00:00+02:00',
    end: '2026-07-17T13:00:00+02:00',
    filter: 'weekdayHours',
    hint: 'Both panes see the picked day: 09:00–17:00 on weekdays, 10:00–14:00 on weekends',
  },
};

export const German: Story = {
  args: { locale: 'de', hint: '24-Stunden-Anzeige (Pp mit de-Locale)' },
};

export const Mixed: Story = {
  args: {
    start: '2026-07-16T09:00:00+02:00',
    end: '2026-07-16T17:30:00+02:00',
    mixed: true,
    mixedLabel: 'Mixed values',
    showMixedState: true,
    hint: 'The hidden range stays intact and unshown; the mixed label is both placeholders. The first resolving commit replaces the whole range.',
  },
};

export const TimeZone: Story = {
  args: {
    label: 'Broadcast window',
    start: '2026-08-18T14:00:00+09:00',
    end: '2026-08-18T18:00:00+09:00',
    timeZone: 'Asia/Tokyo',
    displayFormat: 'MM/dd/yyyy, HH:mm',
    hint: 'Both fields read in the venue zone. The line under them is the same window where you are.',
  },
};
