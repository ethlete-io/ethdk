import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TimelineStorybookComponent } from './timeline-storybook.component';

export default {
  title: 'Components/Data display/Timeline',
  component: TimelineStorybookComponent,
  decorators: [moduleMetadata({ imports: [TimelineStorybookComponent] })],
  args: {
    showTime: true,
    showMarkers: false,
    compact: false,
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
