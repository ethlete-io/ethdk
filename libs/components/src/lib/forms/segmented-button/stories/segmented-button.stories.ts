import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  SegmentedButtonDisabledStorybookComponent,
  SegmentedButtonMultipleStorybookComponent,
  SegmentedButtonSingleStorybookComponent,
} from './segmented-button-storybook.component';

export default {
  title: 'Components/Forms/Segmented Button',
  component: SegmentedButtonSingleStorybookComponent,
  decorators: [moduleMetadata({ imports: [SegmentedButtonSingleStorybookComponent] })],
} as Meta<SegmentedButtonSingleStorybookComponent>;

type Story = StoryObj<SegmentedButtonSingleStorybookComponent>;

export const SingleSelect: Story = {};

export const MultiSelect: StoryObj<SegmentedButtonMultipleStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [SegmentedButtonMultipleStorybookComponent] },
    template: '<et-sb-segmented-button-multiple />',
  }),
};

export const Disabled: StoryObj<SegmentedButtonDisabledStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [SegmentedButtonDisabledStorybookComponent] },
    template: '<et-sb-segmented-button-disabled />',
  }),
};
