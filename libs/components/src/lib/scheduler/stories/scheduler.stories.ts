import { provideColorPalette } from '@ethlete/core';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SchedulerCustomBadgeAdornmentStorybookComponent } from './scheduler-custom-badge-adornment-storybook.component';
import { SchedulerCustomEditFieldStorybookComponent } from './scheduler-custom-edit-surface-storybook.component';
import { SchedulerHeadlessStorybookComponent } from './scheduler-headless-storybook.component';
import { SchedulerInfiniteAgendaStorybookComponent } from './scheduler-infinite-agenda-storybook.component';
import { SchedulerReadOnlyStorybookComponent } from './scheduler-read-only-storybook.component';
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

export const LightSurface: Story = { args: { surface: 'light' } };

export const LightSurfaceWeek: Story = { args: { initialView: 'week', surface: 'light' } };

export const LightSurfaceAgenda: Story = { args: { initialView: 'agenda', surface: 'light' } };

export const WithoutNowIndicator: Story = { args: { initialView: 'day', nowIndicator: false } };

export const Agenda: Story = { args: { initialView: 'agenda' } };

export const ReadOnly: StoryObj<SchedulerReadOnlyStorybookComponent> = {
  render: () => ({ template: '<et-sb-scheduler-read-only />' }),
  decorators: [moduleMetadata({ imports: [SchedulerReadOnlyStorybookComponent] })],
};

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

export const CustomEditField: StoryObj<SchedulerCustomEditFieldStorybookComponent> = {
  render: () => ({ template: '<et-sb-scheduler-custom-edit-field />' }),
  decorators: [moduleMetadata({ imports: [SchedulerCustomEditFieldStorybookComponent] })],
};

export const Headless: StoryObj<SchedulerHeadlessStorybookComponent> = {
  render: () => ({ template: '<et-sb-scheduler-headless />' }),
  decorators: [moduleMetadata({ imports: [SchedulerHeadlessStorybookComponent] })],
};

export const CustomBadgeAdornment: StoryObj<SchedulerCustomBadgeAdornmentStorybookComponent> = {
  render: () => ({ template: '<et-sb-scheduler-custom-badge-adornment />' }),
  decorators: [moduleMetadata({ imports: [SchedulerCustomBadgeAdornmentStorybookComponent] })],
};
