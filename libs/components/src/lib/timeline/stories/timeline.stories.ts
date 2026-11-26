import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TimelineStorybookComponent } from './timeline-storybook.component';

export default {
  title: 'Components/Data display/Timeline',
  component: TimelineStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimelineStorybookComponent] })],
  args: {
    showTime: true,
    showMarkers: false,
    showStatus: false,
    compact: false,
    upcomingRingWidth: null,
    currentRingWidth: null,
  },
  argTypes: {
    upcomingRingWidth: { control: 'text' },
    currentRingWidth: { control: 'text' },
  },
} as Meta<TimelineStorybookComponent>;

type Story = StoryObj<TimelineStorybookComponent>;

export const Default: Story = {};

export const WithMarkers: Story = {
  args: { showMarkers: true },
};

export const Compact: Story = {
  args: { compact: true },
};

export const ItemStatuses: Story = {
  args: { showStatus: true },
};

export const StatusRings: Story = {
  args: { showStatus: true, upcomingRingWidth: '1px', currentRingWidth: '1px' },
};
