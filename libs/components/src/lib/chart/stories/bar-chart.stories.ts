import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BarChartStorybookComponent } from './bar-chart-storybook.component';

export default {
  title: 'Components/Data display/Bar chart',
  component: BarChartStorybookComponent,
  decorators: [moduleMetadata({ imports: [BarChartStorybookComponent] })],
  args: { surface: 'light', dataset: 'sign-ups', width: 640, height: 240, maxBarWidth: 24, colorToken: '' },
  argTypes: {
    surface: { control: 'text' },
    dataset: { control: 'inline-radio', options: ['sign-ups', 'goal-difference'] },
    width: { control: { type: 'range', min: 200, max: 1000, step: 20 } },
    height: { control: { type: 'range', min: 120, max: 480, step: 20 } },
    maxBarWidth: { control: { type: 'range', min: 4, max: 64, step: 2 } },
    colorToken: { control: 'text' },
  },
} as Meta<BarChartStorybookComponent>;

type Story = StoryObj<BarChartStorybookComponent>;

export const Default: Story = {};

export const Dark: Story = {
  args: { surface: 'dark' },
};

export const Negative: Story = {
  args: { dataset: 'goal-difference', colorToken: 'success' },
  parameters: {
    docs: {
      description: {
        story:
          'Values below zero grow down from the baseline, rounded at their data end. `colorToken` names a color ' +
          'theme this Storybook registers; without it the bars take the surrounding accent.',
      },
    },
  },
};
