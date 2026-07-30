import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TimePickerStorybookComponent } from './time-picker-storybook.component';

export default {
  title: 'Components/Time Picker',
  component: TimePickerStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimePickerStorybookComponent] })],
  argTypes: {
    format: { control: 'text' },
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    minTime: { control: 'text' },
    maxTime: { control: 'text' },
    filter: { control: 'select', options: ['none', 'noLunchBreak', 'weekdayHours'] },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    format: 'HH:mm',
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    minTime: null,
    maxTime: null,
    filter: 'none',
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
