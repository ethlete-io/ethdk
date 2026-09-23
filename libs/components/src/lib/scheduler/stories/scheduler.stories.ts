import { provideColorPalette } from '@ethlete/core';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SchedulerInfiniteAgendaStorybookComponent } from './scheduler-infinite-agenda-storybook.component';
import { SchedulerStorybookComponent } from './scheduler-storybook.component';

export default {
  title: 'Components/Date & time/Scheduler',
  component: SchedulerStorybookComponent,
  decorators: [moduleMetadata({ imports: [SchedulerStorybookComponent] })],
} as Meta<SchedulerStorybookComponent>;

type Story = StoryObj<SchedulerStorybookComponent>;

export const Default: Story = {};

export const Week: Story = { args: { initialView: 'week' } };

export const Day: Story = { args: { initialView: 'day' } };

export const BusinessHours: Story = {
  args: {
    initialView: 'week',
    businessHours: [
      { daysOfWeek: [1, 2, 3, 4], start: '08:00', end: '12:00' },
      { daysOfWeek: [1, 2, 3, 4], start: '13:00', end: '18:00' },
      { daysOfWeek: [5], start: '08:00', end: '14:00' },
    ],
  },
};

export const WithoutNowIndicator: Story = { args: { initialView: 'day', nowIndicator: false } };

export const Agenda: Story = { args: { initialView: 'agenda' } };

export const InfiniteAgenda: StoryObj<SchedulerInfiniteAgendaStorybookComponent> = {
  render: () => ({ template: '<et-sb-scheduler-infinite-agenda />' }),
  decorators: [moduleMetadata({ imports: [SchedulerInfiniteAgendaStorybookComponent] })],
};

export const WithoutLocationBadge: Story = { args: { initialView: 'agenda', showLocationBadge: false } };

export const Narrow: Story = { args: { initialView: 'agenda', containerWidth: '380px' } };

export const WithoutAppointmentDrag: Story = { args: { initialView: 'week', allowAppointmentDrag: false } };

export const WithColorPalette: Story = {
  args: { initialView: 'agenda' },
  decorators: [
    moduleMetadata({
      imports: [SchedulerStorybookComponent],
      providers: [
        provideColorPalette([
          { token: 'brand', label: 'Team' },
          { token: 'success', label: 'Training' },
          { token: 'warning', label: 'Travel' },
          { token: 'danger', label: 'Match' },
        ]),
      ],
    }),
  ],
};
