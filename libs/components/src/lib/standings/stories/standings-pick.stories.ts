import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { StandingsPickStorybookComponent } from './standings-pick-storybook.component';

export default {
  title: 'Components/Sports/Standings Pick',
  component: StandingsPickStorybookComponent,
  decorators: [moduleMetadata({ imports: [StandingsPickStorybookComponent] })],
  args: { surface: 'dark', width: 420, advancingCount: 2, locked: false, withStoredPicks: true },
  argTypes: {
    surface: { control: 'text' },
    width: { control: { type: 'range', min: 260, max: 720, step: 20 } },
    advancingCount: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    locked: { control: 'boolean' },
    withStoredPicks: { control: 'boolean' },
  },
} as Meta<StandingsPickStorybookComponent>;

type Story = StoryObj<StandingsPickStorybookComponent>;

export const Default: Story = {};

export const NoStoredPicks: Story = {
  args: { withStoredPicks: false },
  parameters: {
    docs: {
      description: {
        story:
          'Nothing handed in yet, so the list opens in the order the backend listed the participants. A stored pick ' +
          'takes the position it was stored on and everyone else fills the gaps behind it.',
      },
    },
  },
};

export const Locked: Story = {
  args: { locked: true },
  parameters: {
    docs: {
      description: {
        story:
          'The order can no longer be changed: the handles are gone, the list still reads top to bottom, and the ' +
          "row slot carries the app's own mark. The points are the app's - the library scores an outcome only.",
      },
    },
  },
};

export const NoCut: Story = {
  args: { advancingCount: 0 },
  parameters: {
    docs: {
      description: {
        story: 'Without advancing places there is no line to draw - the whole order is just an order.',
      },
    },
  },
};
