import { provideColorPalette } from '@ethlete/core';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { LineChartStorybookComponent } from './line-chart-storybook.component';

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
  moduleMetadata({ imports: [LineChartStorybookComponent], providers: [palette] });

export default {
  title: 'Components/Data display/Line chart',
  component: LineChartStorybookComponent,
  decorators: [moduleMetadata({ imports: [LineChartStorybookComponent] })],
  args: {
    surface: 'light',
    dataset: 'visitors',
    area: false,
    stacked: false,
    points: false,
    width: 640,
    height: 240,
    colorToken: '',
  },
  argTypes: {
    surface: { control: 'text' },
    dataset: { control: 'inline-radio', options: ['visitors', 'tickets', 'daily', 'gaps', 'channels', 'intraday'] },
    area: { control: 'boolean' },
    stacked: { control: 'boolean' },
    points: { control: 'boolean' },
    width: { control: { type: 'range', min: 200, max: 1000, step: 20 } },
    height: { control: { type: 'range', min: 120, max: 480, step: 20 } },
    colorToken: { control: 'text' },
  },
} as Meta<LineChartStorybookComponent>;

type Story = StoryObj<LineChartStorybookComponent>;

export const Default: Story = {};

export const Points: Story = {
  args: { points: true },
};

export const MultiSeries: Story = {
  args: { dataset: 'tickets' },
  decorators: [withPalette(LIGHT_PALETTE)],
  parameters: {
    docs: {
      description: {
        story:
          'Several series, each in the next entry of the `provideColorPalette` palette this story provides. ' +
          'Hovering, tapping or arrowing onto an x lists every series at that x.',
      },
    },
  },
};

export const TimeAxis: Story = {
  args: { dataset: 'daily' },
  parameters: {
    docs: {
      description: {
        story:
          '`Date` x values get a time axis. The ticks pick a calendar interval that fits the width - days here, ' +
          'across the end of March and its daylight-saving change.',
      },
    },
  },
};

export const Intraday: Story = {
  args: { dataset: 'intraday', area: true },
};

export const Gaps: Story = {
  args: { dataset: 'gaps', points: true },
  decorators: [withPalette(LIGHT_PALETTE)],
  parameters: {
    docs: {
      description: {
        story:
          'A `null` value breaks the line. A point with no defined neighbour is drawn as a dot, so it never disappears.',
      },
    },
  },
};

export const Area: Story = {
  args: { area: true },
};

export const StackedArea: Story = {
  args: { dataset: 'channels', area: true, stacked: true },
  decorators: [withPalette(LIGHT_PALETTE)],
};

export const Dark: Story = {
  args: { dataset: 'tickets', surface: 'dark' },
  decorators: [withPalette(DARK_PALETTE)],
  parameters: {
    docs: {
      description: {
        story: 'The dark surface gets its own palette steps, provided as a second `provideColorPalette` palette.',
      },
    },
  },
};

export const StackedAreaDark: Story = {
  args: { dataset: 'channels', area: true, stacked: true, surface: 'dark' },
  decorators: [withPalette(DARK_PALETTE)],
};
