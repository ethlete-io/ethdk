import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TimeRangePickerStorybookComponent } from './time-range-picker-storybook.component';

export default {
  title: 'Components/Date & time/Time Range Picker',
  component: TimeRangePickerStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimeRangePickerStorybookComponent] })],
  argTypes: {
    format: { control: 'text' },
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    start: { control: 'text' },
    end: { control: 'text' },
    minTime: { control: 'text' },
    maxTime: { control: 'text' },
    filter: { control: 'select', options: ['none', 'noLunchBreak', 'weekdayHours', 'endAfterStart'] },
    startLabel: { control: 'text' },
    endLabel: { control: 'text' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    format: 'HH:mm',
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    start: null,
    end: null,
    minTime: null,
    maxTime: null,
    filter: 'none',
    startLabel: null,
    endLabel: null,
    color: 'brand',
  },
} as Meta<TimeRangePickerStorybookComponent>;

type Story = StoryObj<TimeRangePickerStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { start: '09:00', end: '17:30' },
};

export const TwelveHour: Story = {
  args: { format: 'h:mm a', start: '09:00', end: '17:30' },
};

export const EndAfterStart: Story = {
  args: { start: '09:00', filter: 'endAfterStart' },
};

export const OpeningHours: Story = {
  args: { minTime: '08:00', maxTime: '18:00', start: '09:00', end: '17:30' },
};

export const CustomLabels: Story = {
  args: { startLabel: 'Doors open', endLabel: 'Doors close', start: '18:00', end: '23:00' },
};
