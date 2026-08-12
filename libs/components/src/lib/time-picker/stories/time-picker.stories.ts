import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TimePickerStorybookComponent } from './time-picker-storybook.component';

export default {
  title: 'Components/Date & time/Time Picker',
  component: TimePickerStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimePickerStorybookComponent] })],
  argTypes: {
    mode: { control: 'select', options: ['single', 'range'] },
    format: { control: 'text' },
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    minTime: { control: 'text' },
    maxTime: { control: 'text' },
    filter: { control: 'select', options: ['none', 'noLunchBreak', 'weekdayHours', 'endAfterStart'] },
    start: { control: 'text' },
    end: { control: 'text' },
    startLabel: { control: 'text' },
    endLabel: { control: 'text' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    mode: 'single',
    format: 'HH:mm',
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    minTime: null,
    maxTime: null,
    filter: 'none',
    start: null,
    end: null,
    startLabel: null,
    endLabel: null,
    color: 'brand',
  },
} as Meta<TimePickerStorybookComponent>;

type Story = StoryObj<TimePickerStorybookComponent>;

export const Default: Story = {};

export const TwelveHour: Story = {
  args: { format: 'h:mm a' },
};

export const WithSeconds: Story = {
  args: { format: 'HH:mm:ss', secondStep: 15 },
};

export const Bounded: Story = {
  args: { minTime: '09:30', maxTime: '17:00' },
};

export const OpeningHours: Story = {
  args: { minTime: '08:00', maxTime: '20:00', filter: 'noLunchBreak' },
};

export const Range: Story = {
  args: { mode: 'range', start: '09:00', end: '17:30' },
};

export const RangeEmpty: Story = {
  args: { mode: 'range' },
};

export const RangeWithinOneHour: Story = {
  args: { mode: 'range', start: '09:15', end: '09:45' },
};

export const RangeTwelveHour: Story = {
  args: { mode: 'range', format: 'h:mm a', start: '09:00', end: '17:30' },
};

export const RangeEndAfterStart: Story = {
  args: { mode: 'range', start: '09:00', filter: 'endAfterStart' },
};

export const RangeCustomLabels: Story = {
  args: { mode: 'range', startLabel: 'Doors open', endLabel: 'Doors close', start: '18:00', end: '23:00' },
};
