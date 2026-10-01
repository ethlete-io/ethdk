import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { StatTileRowStorybookComponent, StatTileStorybookComponent } from './stat-tile-storybook.component';

export default {
  title: 'Components/Data display/Stat tile',
  component: StatTileStorybookComponent,
  decorators: [moduleMetadata({ imports: [StatTileStorybookComponent, StatTileRowStorybookComponent] })],
  args: {
    label: 'Weekly active users',
    value: 25_240,
    unit: null,
    delta: 0.068,
    goodDirection: 'up',
    caption: 'vs last week',
    loading: false,
    sparkline: true,
  },
  argTypes: {
    goodDirection: { control: 'select', options: ['up', 'down', null] },
  },
} as Meta<StatTileStorybookComponent>;

type Story = StoryObj<StatTileStorybookComponent>;

export const Default: Story = {};

export const KpiRow: Story = {
  render: () => ({ template: `<et-sb-stat-tile-row />` }),
};

export const Loading: Story = {
  render: () => ({ template: `<et-sb-stat-tile-row loading />` }),
};
