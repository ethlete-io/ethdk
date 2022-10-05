import { Meta, Story } from '@storybook/angular';
import { TooltipStorybookComponent } from './components';
import CustomMDXDocumentation from './tooltip.docs.mdx';

export default {
  title: 'Components/Tooltip',
  component: TooltipStorybookComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<TooltipStorybookComponent>;

const Template: Story<TooltipStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
