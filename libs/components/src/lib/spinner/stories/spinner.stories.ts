import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SpinnerStorybookComponent } from './components';

export default {
  title: 'Components/Spinner',
  component: SpinnerStorybookComponent,
  decorators: [moduleMetadata({ imports: [SpinnerStorybookComponent] })],
  args: {
    brandLoader: false,
    diameter: 32,
    strokeWidth: 3.25,
    track: true,
  },
  argTypes: {
    brandLoader: { control: 'boolean' },
    diameter: { control: { type: 'range', min: 12, max: 72, step: 1 } },
    strokeWidth: { control: { type: 'range', min: 1, max: 6, step: 0.25 } },
    track: { control: 'boolean' },
  },
} as Meta<SpinnerStorybookComponent>;

type Story = StoryObj<SpinnerStorybookComponent>;

export const Default: Story = {};

export const WithoutTrack: Story = {
  args: {
    diameter: 20,
    strokeWidth: 2.25,
    track: false,
  },
};

export const BrandLoaderConcept: Story = {
  args: {
    brandLoader: true,
  },
};