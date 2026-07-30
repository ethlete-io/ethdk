import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CalendarStorybookComponent } from './calendar-storybook.component';

export default {
  title: 'Components/Calendar',
  component: CalendarStorybookComponent,
  decorators: [moduleMetadata({ imports: [CalendarStorybookComponent] })],
  argTypes: {
    mode: { control: 'select', options: ['single', 'range'] },
    constrained: { control: 'boolean' },
    disableWeekends: { control: 'boolean' },
    startAtMonthOffset: { control: 'number' },
    startView: { control: 'select', options: ['month', 'year', 'multiYear'] },
    markDates: { control: 'boolean' },
    locale: { control: 'select', options: ['default', 'de'] },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    mode: 'single',
    constrained: false,
    disableWeekends: false,
    startAtMonthOffset: null,
    startView: 'month',
    markDates: false,
    locale: 'default',
    color: 'brand',
  },
} as Meta<CalendarStorybookComponent>;

type Story = StoryObj<CalendarStorybookComponent>;

export const Default: Story = {};

export const Range: Story = {
  args: { mode: 'range' },
};

export const DisabledDates: Story = {
  args: { constrained: true, disableWeekends: true },
};

export const StartAt: Story = {
  args: { startAtMonthOffset: 2 },
};

export const MonthView: Story = {
  args: { startView: 'year' },
};

export const YearView: Story = {
  args: { startView: 'multiYear' },
};

export const DateClass: Story = {
  args: { markDates: true },
};

export const German: Story = {
  args: { locale: 'de' },
};
