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
    locale: { control: 'select', options: ['default', 'de'] },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    mode: 'single',
    constrained: false,
    disableWeekends: false,
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

export const German: Story = {
  args: { locale: 'de' },
};
