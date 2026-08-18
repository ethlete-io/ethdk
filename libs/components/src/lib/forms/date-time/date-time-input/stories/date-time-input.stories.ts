import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateTimeInputStorybookComponent } from './date-time-input-storybook.component';

export default {
  title: 'Components/Forms/Date Time Input',
  component: DateTimeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DateTimeInputStorybookComponent] })],
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
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
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
    label: 'Date & time',
    placeholder: 'mm/dd/yyyy, hh:mm',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: undefined,
    displayFormat: 'Pp',
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    minTime: null,
    maxTime: null,
    filter: 'none',
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<DateTimeInputStorybookComponent>;

type Story = StoryObj<DateTimeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: '2026-07-16T14:30:00+02:00' },
};

export const CustomFormats: Story = {
  args: {
    valueFormat: 'yyyy-MM-dd HH:mm',
    displayFormat: 'dd.MM.yyyy HH:mm',
    placeholder: 'dd.mm.yyyy hh:mm',
    hint: 'Custom wire and display formats',
  },
};

export const OpeningHours: Story = {
  args: {
    value: '2026-07-16T10:00:00+02:00',
    filter: 'weekdayHours',
    hint: 'The time filter sees the picked day: 09:00–17:00 on weekdays, 10:00–14:00 on weekends',
  },
};

export const German: Story = {
  args: { locale: 'de', hint: '24-Stunden-Anzeige (Pp mit de-Locale)' },
};

export const Mixed: Story = {
  args: {
    value: '2026-07-16T14:30:00+02:00',
    mixed: true,
    mixedLabel: 'Mixed values',
    showMixedState: true,
    hint: 'The hidden date-time stays intact and unshown; the mixed label is the placeholder. Parsing a typed value or picking one commits a replacement.',
  },
};

export const TimeZone: Story = {
  args: {
    label: 'Doors open',
    value: '2026-08-18T14:00:00+09:00',
    timeZone: 'Asia/Tokyo',
    displayFormat: 'MM/dd/yyyy, HH:mm',
    hint: 'The field reads in the venue zone. The line under it is the same moment where you are.',
  },
};
