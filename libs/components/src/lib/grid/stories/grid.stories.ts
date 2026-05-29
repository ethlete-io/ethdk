import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { GridStorybookComponent } from './components';

export default {
  title: 'Components/Grid',
  component: GridStorybookComponent,
  decorators: [moduleMetadata({ imports: [GridStorybookComponent] })],
  args: {
    rowHeight: 100,
    gap: 16,
  },
  argTypes: {
    rowHeight: { control: { type: 'range', min: 50, max: 300, step: 10 } },
    gap: { control: { type: 'range', min: 0, max: 48, step: 4 } },
  },
} as Meta<GridStorybookComponent>;

type Story = StoryObj<GridStorybookComponent>;

export const Default: Story = {};

export const CompactGrid: Story = {
  args: {
    rowHeight: 80,
    gap: 8,
  },
};

export const LargeItems: Story = {
  args: {
    rowHeight: 150,
    gap: 24,
  },
};

export const SixColumnGrid: Story = {
  args: {
    breakpoints: [
      { name: 'lg', columns: 6, minWidth: 900 },
      { name: 'md', columns: 3, minWidth: 500 },
      { name: 'sm', columns: 1, minWidth: 0 },
    ],
  },
};
