import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ProgressBarStorybookComponent } from './components';

export default {
  title: 'Components/Loader/Progress Bar',
  component: ProgressBarStorybookComponent,
  decorators: [moduleMetadata({ imports: [ProgressBarStorybookComponent] })],
  args: {
    value: 42,
    indeterminate: false,
  },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    indeterminate: { control: 'boolean' },
  },
} as Meta<ProgressBarStorybookComponent>;

type Story = StoryObj<ProgressBarStorybookComponent>;

export const Default: Story = {};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
  },
};

export const Complete: Story = {
  args: {
    value: 100,
  },
};
