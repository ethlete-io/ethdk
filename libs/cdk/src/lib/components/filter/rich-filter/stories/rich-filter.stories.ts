import { Meta, Story } from '@storybook/angular';
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

const Template: Story<RichFilterStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
