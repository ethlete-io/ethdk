import { provideColorPalette } from '@ethlete/core';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { PieChartStorybookComponent } from './pie-chart-storybook.component';

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
  moduleMetadata({ imports: [PieChartStorybookComponent], providers: [palette] });

export default {
  title: 'Components/Data display/Pie chart',
  component: PieChartStorybookComponent,
  decorators: [moduleMetadata({ imports: [PieChartStorybookComponent] })],
  args: {
    surface: 'light',
    dataset: 'devices',
    width: 520,
    size: 200,
    innerRadius: 0,
    showTotal: false,
    centerText: '',
    colorToken: '',
  },
  argTypes: {
    surface: { control: 'text' },
    dataset: { control: 'inline-radio', options: ['devices', 'channels', 'single', 'with-zero'] },
    width: { control: { type: 'range', min: 200, max: 1000, step: 20 } },
    size: { control: { type: 'range', min: 80, max: 400, step: 10 } },
    innerRadius: { control: { type: 'range', min: 0, max: 0.9, step: 0.05 } },
    showTotal: { control: 'boolean' },
    centerText: { control: 'text' },
    colorToken: { control: 'text' },
  },
} as Meta<PieChartStorybookComponent>;

type Story = StoryObj<PieChartStorybookComponent>;

export const Default: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
};

export const Donut: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { innerRadius: 0.6 },
};

export const DonutTotal: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { innerRadius: 0.6, showTotal: true },
  parameters: {
    docs: {
      description: {
        story: '`showTotal` puts the formatted sum of every slice in the donut hole, above `totalLabel`.',
      },
    },
  },
};

export const DonutCenterContent: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { innerRadius: 0.6, centerText: 'Last 30 days' },
  parameters: {
    docs: {
      description: {
        story: 'Content marked `etPieChartCenter` is projected into the donut hole.',
      },
    },
  },
};

export const ManySlices: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { dataset: 'channels', innerRadius: 0.6 },
  parameters: {
    docs: {
      description: {
        story:
          'Eight slices against a four-entry palette: the slices past the palette take lighter steps of the accent. ' +
          'Past about six slices, a bar chart reads better.',
      },
    },
  },
};

export const SingleSlice: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { dataset: 'single' },
};

export const WithZero: Story = {
  decorators: [withPalette(LIGHT_PALETTE)],
  args: { dataset: 'with-zero' },
  parameters: {
    docs: {
      description: {
        story: 'A value of 0 draws no slice, but keeps its place in the legend and the table.',
      },
    },
  },
};

export const NoPalette: Story = {
  args: { dataset: 'devices' },
  parameters: {
    docs: {
      description: {
        story: 'Without a palette, every slice is drawn in its own step of the accent, from full strength to 40%.',
      },
    },
  },
};

export const Dark: Story = {
  args: { surface: 'dark', innerRadius: 0.6, showTotal: true },
  decorators: [withPalette(DARK_PALETTE)],
  parameters: {
    docs: {
      description: {
        story: 'The dark surface gets its own palette steps, provided as a second `provideColorPalette` palette.',
      },
    },
  },
};
