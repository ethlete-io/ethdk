import { Meta, StoryFn } from '@storybook/angular';
import { RichFilterStorybookComponent } from './components';
import CustomMDXDocumentation from './rich-filter.docs.mdx';

export default {
  title: 'CDK/Filters/Rich Filter',
  component: RichFilterStorybookComponent,
  argTypes: {},
  args: {},
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<RichFilterStorybookComponent>;

const Template: StoryFn<RichFilterStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
