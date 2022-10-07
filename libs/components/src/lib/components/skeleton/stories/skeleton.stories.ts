import { Meta, Story } from '@storybook/angular';
import { SkeletonStorybookComponent } from './components';
import CustomMDXDocumentation from './skeleton.docs.mdx';

export default {
  title: 'Components/Skeleton',
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

const Template: Story<SkeletonStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
