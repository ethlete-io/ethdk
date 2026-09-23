import { provideColorPalette } from '@ethlete/core';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SankeyChartStorybookComponent } from './sankey-chart-storybook.component';

const LIGHT_PALETTE = provideColorPalette([
  { token: 'chart-blue', label: 'Blue' },
  { token: 'chart-orange', label: 'Orange' },
  { token: 'chart-aqua', label: 'Aqua' },
  { token: 'chart-yellow', label: 'Yellow' },
]);

const DARK_PALETTE = provideColorPalette([
  { token: 'chart-blue-dark', label: 'Blue' },
  { token: 'chart-orange-dark', label: 'Orange' },
  { token: 'chart-aqua-dark', label: 'Aqua' },
  { token: 'chart-yellow-dark', label: 'Yellow' },
]);

const withPalette = (palette: typeof LIGHT_PALETTE) =>
  moduleMetadata({ imports: [SankeyChartStorybookComponent], providers: [palette] });

export default {
  title: 'Components/Data display/Sankey chart',
  component: SankeyChartStorybookComponent,
  decorators: [moduleMetadata({ imports: [SankeyChartStorybookComponent] })],
  args: {
    surface: 'light',
    dataset: 'match-day',
    width: 720,
    height: 320,
    nodeGap: 12,
    labelWidth: 120,
    colorToken: 'neutral',
  },
  argTypes: {
    surface: { control: 'text' },
    dataset: { control: 'inline-radio', options: ['match-day', 'budget', 'traffic'] },
    width: { control: { type: 'range', min: 240, max: 1200, step: 20 } },
    height: { control: { type: 'range', min: 160, max: 640, step: 20 } },
    nodeGap: { control: { type: 'range', min: 0, max: 40, step: 2 } },
    labelWidth: { control: { type: 'range', min: 40, max: 200, step: 10 } },
    colorToken: { control: 'text' },
  },
} as Meta<SankeyChartStorybookComponent>;

type Story = StoryObj<SankeyChartStorybookComponent>;

export const Default: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
};

export const MultiLevel: Story = {
  args: { dataset: 'budget', height: 400 },
  decorators: [withPalette(LIGHT_PALETTE)],
  parameters: {
    docs: {
      description: {
        story:
          'Four columns: income, the budget, departments and cost types. Node `i` takes palette entry `i`; nodes ' +
          "past the palette take the chart's `colorToken`, here `neutral`, a theme this Storybook registers. The zero link from Sponsoring to the academy draws no " +
          'ribbon but is listed in the table view.',
      },
    },
  },
};

export const ManyNodes: Story = {
  args: { dataset: 'traffic', width: 960, height: 480 },
  decorators: [withPalette(LIGHT_PALETTE)],
};

export const Dark: Story = {
  args: { dataset: 'budget', surface: 'dark', height: 400 },
  decorators: [withPalette(DARK_PALETTE)],
  parameters: {
    docs: {
      description: {
        story: 'The dark surface gets its own palette steps, provided as a second `provideColorPalette` palette.',
      },
    },
  },
};
