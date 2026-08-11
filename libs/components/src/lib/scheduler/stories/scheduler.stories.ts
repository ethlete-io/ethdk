import { provideColorPalette } from '@ethlete/core';
import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SchedulerStorybookComponent } from './scheduler-storybook.component';

export default {
  title: 'Components/Scheduler',
  component: SchedulerStorybookComponent,
  decorators: [moduleMetadata({ imports: [SchedulerStorybookComponent] })],
} as Meta<SchedulerStorybookComponent>;

type Story = StoryObj<SchedulerStorybookComponent>;

export const Default: Story = {};

export const Week: Story = { args: { initialView: 'week' } };

export const Day: Story = { args: { initialView: 'day' } };

export const Agenda: Story = { args: { initialView: 'agenda' } };

export const WithoutLocationBadge: Story = { args: { initialView: 'agenda', showLocationBadge: false } };

export const Narrow: Story = { args: { initialView: 'agenda', containerWidth: '380px' } };

/** Appointments cannot be dragged to another time here; drawing a new range still works. */
export const WithoutAppointmentDrag: Story = { args: { initialView: 'week', allowAppointmentDrag: false } };

/** Select an appointment and open the edit surface: the color field is a swatch picker, not a text box. */
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
