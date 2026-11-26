import { Meta, StoryFn } from '@storybook/angular';
import { SkeletonStorybookComponent } from './components';
import CustomMDXDocumentation from './skeleton.docs.mdx';

export default {
  title: 'CDK/Skeleton',
  component: SkeletonStorybookComponent,
  argTypes: {
    loadingAllyText: {
      control: {
        type: 'text',
      },
    },
    animated: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    loadingAllyText: 'Loading...',
    animated: true,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<SkeletonStorybookComponent>;

const Template: StoryFn<SkeletonStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
