import { provideColorPalette } from '@ethlete/core';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BarChartStorybookComponent } from './bar-chart-storybook.component';

const PALETTE = provideColorPalette([
  { token: 'chart-blue', label: 'Blue' },
  { token: 'chart-orange', label: 'Orange' },
  { token: 'chart-aqua', label: 'Aqua' },
  { token: 'chart-yellow', label: 'Yellow' },
]);

const withPalette = (palette: typeof PALETTE) =>
  moduleMetadata({ imports: [BarChartStorybookComponent], providers: [palette] });

export default {
  title: 'Components/Data display/Bar chart',
  component: BarChartStorybookComponent,
  decorators: [moduleMetadata({ imports: [BarChartStorybookComponent] })],
  args: {
    dataset: 'sign-ups',
    layout: 'grouped',
    orientation: 'vertical',
    width: 640,
    height: 240,
    maxBarWidth: 24,
    colorToken: '',
    lastSeriesColorToken: '',
    categoryLabelSpacing: 'auto',
    chartTitle: '',
    chartNote: '',
  },
  argTypes: {
    dataset: {
      control: 'inline-radio',
      options: ['sign-ups', 'goal-difference', 'goals', 'tickets', 'budget', 'daily-visits', 'empty'],
    },
    layout: { control: 'inline-radio', options: ['grouped', 'stacked'] },
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    width: { control: { type: 'range', min: 200, max: 1000, step: 20 } },
    height: { control: { type: 'range', min: 120, max: 480, step: 20 } },
    maxBarWidth: { control: { type: 'range', min: 4, max: 64, step: 2 } },
    colorToken: { control: 'text' },
    lastSeriesColorToken: { control: 'text' },
    categoryLabelSpacing: { control: 'text' },
    chartTitle: { control: 'text' },
    chartNote: { control: 'text' },
  },
} as Meta<BarChartStorybookComponent>;

type Story = StoryObj<BarChartStorybookComponent>;

export const Default: Story = {};

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

export const Grouped: Story = {
  args: { dataset: 'tickets' },
  decorators: [withPalette(PALETTE)],
  parameters: {
    docs: {
      description: {
        story:
          'Several series side by side per category, each in the next entry of the `provideColorPalette` palette ' +
          'this story provides.',
      },
    },
  },
};

export const Stacked: Story = {
  args: { dataset: 'tickets', layout: 'stacked' },
  decorators: [withPalette(PALETTE)],
};

export const StackedNegative: Story = {
  args: { dataset: 'budget', layout: 'stacked' },
  decorators: [withPalette(PALETTE)],
  parameters: {
    docs: {
      description: {
        story: 'Positive values stack up from the baseline and negative values stack down from it.',
      },
    },
  },
};

export const Horizontal: Story = {
  args: { dataset: 'goals', orientation: 'horizontal', height: 200 },
};

export const HorizontalStacked: Story = {
  args: { dataset: 'budget', layout: 'stacked', orientation: 'horizontal' },
  decorators: [withPalette(PALETTE)],
};

export const SeriesColorToken: Story = {
  args: { dataset: 'tickets', lastSeriesColorToken: 'neutral' },
  decorators: [withPalette(PALETTE)],
  parameters: {
    docs: {
      description: {
        story: "A series' own `colorToken` wins over its palette entry - here the last series is drawn in `neutral`.",
      },
    },
  },
};

export const DenseLabels: Story = {
  args: {
    dataset: 'daily-visits',
    chartTitle: 'Visits per day',
    chartNote: 'Source: web analytics, March',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Thirty-one categories on a narrow plot. Category labels are thinned to every nth, so each shown label ' +
          'gets at least `categoryLabelSpacing` px - `auto` estimates that from the longest label. ' +
          '`etBarChartTitle` and `etBarChartNote` are projected above and below the chart.',
      },
    },
  },
};

export const Empty: Story = {
  args: {
    dataset: 'empty',
    chartTitle: 'Visits per day',
    chartNote: 'Source: web analytics, April',
  },
  parameters: {
    docs: {
      description: {
        story: 'While `data` is empty, projected `etBarChartEmpty` content is shown over the plot.',
      },
    },
  },
};
