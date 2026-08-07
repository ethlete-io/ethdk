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
