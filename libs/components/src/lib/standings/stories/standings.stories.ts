import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { StandingsStorybookComponent } from './standings-storybook.component';

export default {
  title: 'Components/Standings',
  component: StandingsStorybookComponent,
  decorators: [moduleMetadata({ imports: [StandingsStorybookComponent] })],
  args: { surface: 'dark', width: 760, showLegend: true, highlight: true, withZones: true, withForm: true },
  argTypes: {
    surface: { control: 'text' },
    width: { control: { type: 'range', min: 280, max: 900, step: 20 } },
    showLegend: { control: 'boolean' },
    highlight: { control: 'boolean' },
    withZones: { control: 'boolean' },
    withForm: { control: 'boolean' },
  },
} as Meta<StandingsStorybookComponent>;

type Story = StoryObj<StandingsStorybookComponent>;

export const Default: Story = {};

export const Compact: Story = {
  args: { width: 340 },
  parameters: {
    docs: {
      description: {
        story:
          'Narrow: the form column goes first, then the played/won/drawn/lost block, leaving the three columns a ' +
          'table is unreadable without - position, participant, points. The zone bands and the legend stay.',
      },
    },
  },
};

export const NoZones: Story = {
  args: { withZones: false },
  parameters: {
    docs: {
      description: {
        story:
          'Without zones there is no banding and no legend - nothing to explain. Zones are a config, not a mode: ' +
          'the same array draws the bands and the legend, so the two cannot drift apart.',
      },
    },
  },
};
