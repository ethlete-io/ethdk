import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BannerStorybookComponent } from './banner-storybook.component';

export default {
  title: 'Components/Feedback/Banner',
  component: BannerStorybookComponent,
  decorators: [moduleMetadata({ imports: [BannerStorybookComponent] })],
  args: {
    heading: 'Heads up',
    description: 'This is an informational message for the current page or section.',
    type: 'info',
    icon: 'et-circle-info',
    dismissible: true,
    showAction: true,
  },
  argTypes: {
    type: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
    icon: { control: 'select', options: ['et-circle-info', 'et-circle-check', 'et-triangle-exclamation'] },
  },
} as Meta<BannerStorybookComponent>;

type Story = StoryObj<BannerStorybookComponent>;

export const Info: Story = {};

export const Success: Story = {
  args: {
    heading: 'Changes saved',
    description: 'Your changes have been saved successfully.',
    type: 'success',
    icon: 'et-circle-check',
    showAction: false,
  },
};

export const Warning: Story = {
  args: {
    heading: 'Storage almost full',
    description: 'You are running low on storage space - consider upgrading your plan.',
    type: 'warning',
    icon: 'et-triangle-exclamation',
  },
};

export const Error: Story = {
  args: {
    heading: 'Something went wrong',
    description: 'We could not save your changes. Please try again.',
    type: 'error',
    icon: 'et-triangle-exclamation',
  },
};

export const WithoutDismiss: Story = {
  args: { dismissible: false },
};
