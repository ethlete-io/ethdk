import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { EmptyStateStorybookComponent } from './empty-state-storybook.component';

export default {
  title: 'Components/Empty state',
  component: EmptyStateStorybookComponent,
  decorators: [moduleMetadata({ imports: [EmptyStateStorybookComponent] })],
  args: {
    heading: 'No results',
    description: 'Try a different search term or clear your filters.',
    icon: 'et-file',
    showAction: true,
  },
  argTypes: { icon: { control: 'select', options: ['et-file', 'et-triangle-exclamation'] } },
} as Meta<EmptyStateStorybookComponent>;

type Story = StoryObj<EmptyStateStorybookComponent>;

export const Default: Story = {};

export const WithoutAction: Story = {
  args: { showAction: false },
};

export const Errored: Story = {
  args: {
    heading: 'Something went wrong',
    description: 'We could not load this data. Please try again.',
    icon: 'et-triangle-exclamation',
  },
};
