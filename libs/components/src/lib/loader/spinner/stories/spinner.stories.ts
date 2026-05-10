import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SpinnerStorybookComponent } from './components';

export default {
  title: 'Components/Loader/Spinner',
  component: SpinnerStorybookComponent,
  decorators: [moduleMetadata({ imports: [SpinnerStorybookComponent] })],
  args: {
    diameter: 45,
    strokeWidth: 2,
    track: true,
    determinate: false,
    value: 0,
  },
  argTypes: {
    diameter: { control: { type: 'range', min: 12, max: 72, step: 1 } },
    strokeWidth: { control: { type: 'range', min: 1, max: 6, step: 0.25 } },
    track: { control: 'boolean' },
    determinate: { control: 'boolean' },
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
} as Meta<SpinnerStorybookComponent>;

type Story = StoryObj<SpinnerStorybookComponent>;

export const Default: Story = {};

export const WithoutTrack: Story = {
  args: {
    diameter: 45,
    strokeWidth: 2,
    track: false,
  },
};

export const Determinate: Story = {
  args: {
    determinate: true,
    value: 65,
    track: true,
  },
};

export const DeterminateComplete: Story = {
  args: {
    determinate: true,
    value: 100,
    track: true,
  },
};
